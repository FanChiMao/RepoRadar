from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import image_fetch  # noqa: E402
from core.image_fetch import ImageAsset  # noqa: E402


class FakeResponse:
    def __init__(self, content: bytes, content_type: str = "image/png") -> None:
        self.content = content
        self.headers = {"Content-Type": content_type}

    def raise_for_status(self) -> None:
        return None


class ExtractImageUrlsTests(unittest.TestCase):
    def test_returns_empty_for_blank_body(self) -> None:
        self.assertEqual([], image_fetch.extract_image_urls(""))

    def test_extracts_markdown_and_html_images_in_order(self) -> None:
        body = (
            'text ![alt](https://a.com/1.png "title") more\n'
            '<img src="https://a.com/2.jpg" />'
        )
        self.assertEqual(
            ["https://a.com/1.png", "https://a.com/2.jpg"],
            image_fetch.extract_image_urls(body),
        )

    def test_deduplicates_preserving_order(self) -> None:
        body = "![](https://a.com/1.png) ![](https://a.com/1.png)"
        self.assertEqual(["https://a.com/1.png"], image_fetch.extract_image_urls(body))


class ResolveImageUrlTests(unittest.TestCase):
    def test_absolute_url_passthrough(self) -> None:
        self.assertEqual(
            "https://a.com/x.png",
            image_fetch.resolve_image_url("https://a.com/x.png"),
        )

    def test_gitlab_uploads_use_api_path(self) -> None:
        resolved = image_fetch.resolve_image_url(
            "/uploads/abc123/pic.png",
            provider_name="gitlab",
            base_url="https://gitlab.example.com/",
            project_ref="group/project",
        )
        self.assertEqual(
            "https://gitlab.example.com/api/v4/projects/group%2Fproject"
            "/uploads/abc123/pic.png",
            resolved,
        )

    def test_uploads_with_web_base_when_not_gitlab(self) -> None:
        resolved = image_fetch.resolve_image_url(
            "/uploads/abc/pic.png",
            project_web_base="https://host/group/project/",
        )
        self.assertEqual("https://host/group/project/uploads/abc/pic.png", resolved)

    def test_root_relative_uses_base_url(self) -> None:
        self.assertEqual(
            "https://base.com/img/pic.png",
            image_fetch.resolve_image_url("/img/pic.png", base_url="https://base.com"),
        )

    def test_relative_uses_project_web_base(self) -> None:
        self.assertEqual(
            "https://host/proj/pic.png",
            image_fetch.resolve_image_url(
                "pic.png", project_web_base="https://host/proj"
            ),
        )

    def test_relative_falls_back_to_base_url(self) -> None:
        self.assertEqual(
            "https://base.com/pic.png",
            image_fetch.resolve_image_url("pic.png", base_url="https://base.com"),
        )


class ProjectWebBaseTests(unittest.TestCase):
    def test_none_for_missing_url(self) -> None:
        self.assertIsNone(image_fetch.project_web_base_from_issue_url(None))

    def test_strips_gitlab_issue_path(self) -> None:
        self.assertEqual(
            "https://gitlab.com/group/project",
            image_fetch.project_web_base_from_issue_url(
                "https://gitlab.com/group/project/-/issues/42"
            ),
        )

    def test_strips_github_issue_path(self) -> None:
        self.assertEqual(
            "https://github.com/owner/repo",
            image_fetch.project_web_base_from_issue_url(
                "https://github.com/owner/repo/issues/7"
            ),
        )

    def test_returns_none_when_no_marker(self) -> None:
        self.assertIsNone(
            image_fetch.project_web_base_from_issue_url("https://example.com/x")
        )


class ImageAssetTests(unittest.TestCase):
    def test_data_uri_and_base64(self) -> None:
        asset = ImageAsset(
            key=1, note_index=1, url="x", media_type="image/png", data=b"hello"
        )
        self.assertEqual("aGVsbG8=", asset.base64_data())
        self.assertEqual("data:image/png;base64,aGVsbG8=", asset.data_uri())


class DownloadImagesTests(unittest.TestCase):
    def runtime_dir(self) -> Path:
        import shutil
        import uuid

        path = BACKEND_DIR / "data" / f"test-img-{uuid.uuid4().hex}"
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def test_empty_items_returns_empty(self) -> None:
        self.assertEqual(
            [], image_fetch.download_images(Mock(), [], self.runtime_dir())
        )

    def test_unauthenticated_download_writes_file(self) -> None:
        dest = self.runtime_dir()
        client = Mock(spec=[])  # no session / base_url
        with patch.object(
            image_fetch.requests,
            "get",
            return_value=FakeResponse(b"x" * 5000),
        ) as get:
            assets = image_fetch.download_images(
                client, [(1, "https://cdn.com/a.png")], dest
            )
        self.assertTrue(assets[0].ok)
        self.assertTrue(Path(assets[0].path).exists())
        self.assertEqual("image/png", assets[0].media_type)
        get.assert_called_once()

    def test_authenticated_session_used_for_provider_host(self) -> None:
        dest = self.runtime_dir()
        session = Mock()
        session.get.return_value = FakeResponse(b"y" * 5000, "image/jpeg")

        class FakeClient:
            base_url = "https://gitlab.example.com"
            verify_ssl = False

        client = FakeClient()
        client.session = session
        assets = image_fetch.download_images(
            client, [(1, "https://gitlab.example.com/api/v4/uploads/a")], dest
        )
        self.assertTrue(assets[0].ok)
        session.get.assert_called_once()
        self.assertEqual("image/jpeg", assets[0].media_type)

    def test_rejects_html_content(self) -> None:
        dest = self.runtime_dir()
        with patch.object(
            image_fetch.requests,
            "get",
            return_value=FakeResponse(b"x" * 5000, "text/html"),
        ):
            assets = image_fetch.download_images(
                Mock(spec=[]), [(1, "https://cdn.com/a.png")], dest
            )
        self.assertFalse(assets[0].ok)
        self.assertIn("非圖片", assets[0].error)

    def test_rejects_too_small_image(self) -> None:
        dest = self.runtime_dir()
        with patch.object(
            image_fetch.requests, "get", return_value=FakeResponse(b"tiny")
        ):
            assets = image_fetch.download_images(
                Mock(spec=[]), [(1, "https://cdn.com/a.png")], dest
            )
        self.assertFalse(assets[0].ok)

    def test_respects_max_count(self) -> None:
        dest = self.runtime_dir()
        with patch.object(
            image_fetch.requests, "get", return_value=FakeResponse(b"x" * 5000)
        ):
            assets = image_fetch.download_images(
                Mock(spec=[]),
                [(1, "https://cdn.com/a.png"), (2, "https://cdn.com/b.png")],
                dest,
                max_count=1,
            )
        self.assertEqual(1, len(assets))


if __name__ == "__main__":
    unittest.main()
