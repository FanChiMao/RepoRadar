"""留言圖片擷取：從留言 markdown 抽出圖片、下載、暫存。

供 Issue 整理頁的 Hybrid 多模態流程使用：
  - extract_image_urls：抽 markdown / HTML 圖片參照
  - resolve_image_url：把相對路徑補成絕對 URL（GitLab 專案 uploads）
  - download_images：用 provider 既有認證下載並暫存
"""

from __future__ import annotations

import base64
import ipaddress
import re
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin, urlparse

import requests

# markdown ![alt](url "title") 與 HTML <img src="url">
# 注意：alt 與 url 量詞用 possessive（*+ / ++）避免在 '![](' 大量重複時的多項式回溯（ReDoS）。
_MD_IMG_RE = re.compile(r"!\[[^\]]*+\]\(\s*<?([^)\s>]++)>?(?:\s+\"[^\"]*\")?\s*\)")
_HTML_IMG_RE = re.compile(r"<img\b[^>]*?\bsrc\s*=\s*[\"']([^\"']+)[\"']", re.IGNORECASE)

_IMG_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")
_MIME_BY_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}

DEFAULT_MAX_COUNT = 6
DEFAULT_MAX_BYTES = 4 * 1024 * 1024
DEFAULT_MIN_BYTES = 2 * 1024  # 過濾 emoji / icon / 簽名小圖


@dataclass
class ImageAsset:
    key: int  # 文中 【圖片#key】 的序號（1-based）
    note_index: int  # 來源留言序號（1-based，對應 build_issue_raw_text 的留言編號）
    url: str
    ok: bool = False
    path: str | None = None
    media_type: str = "image/png"
    data: bytes = b""
    caption: str = ""
    error: str = ""

    def data_uri(self) -> str:
        b64 = base64.b64encode(self.data).decode("ascii")
        return f"data:{self.media_type};base64,{b64}"

    def base64_data(self) -> str:
        return base64.b64encode(self.data).decode("ascii")


def extract_image_urls(body: str) -> list[str]:
    """依出現順序抽出留言 body 內的圖片參照（去重保序）。"""
    if not body:
        return []
    refs: list[str] = []
    for match in _MD_IMG_RE.finditer(body):
        refs.append(match.group(1).strip())
    for match in _HTML_IMG_RE.finditer(body):
        refs.append(match.group(1).strip())
    seen: set[str] = set()
    ordered: list[str] = []
    for ref in refs:
        if ref and ref not in seen:
            seen.add(ref)
            ordered.append(ref)
    return ordered


def _looks_like_image(ref: str) -> bool:
    lowered = ref.split("?")[0].lower()
    if lowered.endswith(_IMG_EXT):
        return True
    # GitHub 附件 / 簽名 URL 常無副檔名，靠 host 判斷
    host = urlparse(ref).netloc.lower()
    return any(
        token in host
        for token in ("githubusercontent.com", "user-attachments", "github.com")
    )


def resolve_image_url(
    ref: str,
    *,
    provider_name: str = "",
    base_url: str = "",
    project_ref: str = "",
    project_web_base: str | None = None,
) -> str:
    """把圖片參照補成絕對 URL（可下載）。

    - 已是 http(s)：原樣。
    - GitLab 專案 `/uploads/<secret>/<file>`：改用 uploads API
      `{base}/api/v4/projects/{quoted}/uploads/{secret}/{file}`（web 路徑不吃 PRIVATE-TOKEN）。
    - 其他 root-relative `/...`：用 base_url / project_web_base 補。
    """
    ref = ref.strip()
    if ref.startswith("http://") or ref.startswith("https://"):
        return ref
    base_url = (base_url or "").rstrip("/")
    if provider_name == "gitlab" and ref.startswith("/uploads/") and project_ref:
        parts = ref.strip("/").split("/")  # ['uploads', secret, filename...]
        if len(parts) >= 3:
            secret = parts[1]
            filename = "/".join(parts[2:])
            quoted = quote(project_ref, safe="")
            return f"{base_url}/api/v4/projects/{quoted}/uploads/{secret}/{filename}"
    if ref.startswith("/uploads/") and project_web_base:
        return f"{project_web_base.rstrip('/')}{ref}"
    if ref.startswith("/"):
        return f"{base_url}{ref}"
    if project_web_base:
        return f"{project_web_base.rstrip('/')}/{ref}"
    return f"{base_url}/{ref}"


def project_web_base_from_issue_url(web_url: str | None) -> str | None:
    """從 issue 的 web_url 推回專案網址（去掉 /-/issues/.. 或 /issues/..）。"""
    if not web_url:
        return None
    for marker in ("/-/issues/", "/-/work_items/", "/issues/", "/work_items/"):
        idx = web_url.find(marker)
        if idx != -1:
            return web_url[:idx]
    return None


def _media_type_from(url: str, content_type: str | None) -> str:
    if content_type and content_type.startswith("image/"):
        return content_type.split(";")[0].strip()
    ext = Path(urlparse(url).path).suffix.lower()
    return _MIME_BY_EXT.get(ext, "image/png")


def _safe_ext_from_media_type(media_type: str) -> str:
    """由 media_type 推副檔名，只允許白名單，避免把分隔符/路徑帶進檔名。"""
    sub = media_type.split("/")[-1].strip().lower().replace("jpeg", "jpg")
    return "." + sub if re.fullmatch(r"[a-z0-9]{1,8}", sub) else ".png"


def _is_safe_public_url(url: str) -> bool:
    """SSRF 防護：僅允許 http(s) 且主機解析後全部為公開位址。

    阻擋 loopback / 私網 / link-local / reserved / multicast 等內網目標，
    避免使用者留言中的圖片連結被用來打內部服務（如 169.254.169.254）。
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    if parsed.scheme not in ("http", "https"):
        return False
    host = parsed.hostname
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
            or ip.is_unspecified
        ):
            return False
    return True


def _guarded_get(
    url: str, *, timeout: int = 30, max_redirects: int = 5
) -> requests.Response:
    """對「完全由使用者控制」的 URL 做 SSRF-safe GET。

    每一次（含 redirect 後）都重新驗證目標位址，因此把 redirect 手動逐跳展開
    （allow_redirects=False），避免初始 URL 合法但 302 轉址到內網。
    """
    for _ in range(max_redirects + 1):
        if not _is_safe_public_url(url):
            raise ValueError("圖片 URL 指向內網或非 http(s)，已阻擋")
        resp = requests.get(url, timeout=timeout, allow_redirects=False)
        if getattr(resp, "is_redirect", False) or getattr(
            resp, "is_permanent_redirect", False
        ):
            location = resp.headers.get("Location")
            if not location:
                return resp
            url = urljoin(url, location)
            continue
        return resp
    raise ValueError("圖片 URL redirect 次數過多，已略過")


def download_images(
    client: Any,
    items: list[tuple[int, str]],
    dest_dir: Path,
    *,
    max_count: int = DEFAULT_MAX_COUNT,
    max_bytes: int = DEFAULT_MAX_BYTES,
    min_bytes: int = DEFAULT_MIN_BYTES,
) -> list[ImageAsset]:
    """下載圖片並暫存。

    items：[(note_index, absolute_url), ...]（已 resolve 過）。
    認證：URL host 與 provider 同網域 → 用 client 既有 authed session；否則用無認證 GET
    （避免 Authorization 破壞 CDN 簽名 URL）。
    """
    assets: list[ImageAsset] = []
    if not items:
        return assets

    dest_dir.mkdir(parents=True, exist_ok=True)
    provider_hosts = _provider_hosts(client)
    verify_ssl = getattr(client, "verify_ssl", True)
    authed_session = getattr(client, "session", None)

    for key, (note_index, url) in enumerate(items, start=1):
        if key > max_count:
            break
        asset = ImageAsset(key=key, note_index=note_index, url=url)
        try:
            host = urlparse(url).netloc.lower()
            use_auth = authed_session is not None and any(
                host == h or host.endswith("." + h) for h in provider_hosts
            )
            if use_auth:
                # 認證分支只會打已設定的 provider host（使用者自填、可信，
                # 含自架 GitLab 內網），維持既有行為。
                resp = authed_session.get(
                    url, timeout=30, verify=verify_ssl, allow_redirects=True
                )
            else:
                # 完全由留言內容控制的外部 URL → 走 SSRF guard。
                resp = _guarded_get(url, timeout=30)
            resp.raise_for_status()
            content = resp.content
            ctype = resp.headers.get("Content-Type", "")
            # 只擋明確的網頁/文字（GitLab uploads API 回 application/octet-stream，需接受）
            if ctype and (ctype.startswith("text/") or "html" in ctype.lower()):
                raise ValueError(f"非圖片內容（{ctype[:40]}）")
            if len(content) < min_bytes:
                raise ValueError("圖片過小，略過")
            if len(content) > max_bytes:
                raise ValueError("圖片過大，略過")
            media_type = _media_type_from(url, ctype)
            ext = _safe_ext_from_media_type(media_type)
            # 檔名僅由序號 + 白名單副檔名組成；再確認最終路徑仍封閉在 dest_dir 內。
            out_path = dest_dir / f"image_{key:02d}{ext}"
            dest_root = dest_dir.resolve()
            if not out_path.resolve().is_relative_to(dest_root):
                raise ValueError("輸出路徑逸出目標目錄，已略過")
            out_path.write_bytes(content)
            asset.ok = True
            asset.path = str(out_path)
            asset.media_type = media_type
            asset.data = content
        except Exception as exc:  # noqa: BLE001
            asset.ok = False
            asset.error = str(exc)[:200]
        assets.append(asset)

    return assets


def _provider_hosts(client: Any) -> set[str]:
    hosts: set[str] = set()
    for attr in ("base_url", "web_base_url", "api_base_url"):
        value = getattr(client, attr, None)
        if value:
            netloc = urlparse(value).netloc.lower()
            if netloc:
                hosts.add(netloc)
    return hosts
