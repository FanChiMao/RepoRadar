"""At-rest encryption for secret config fields (tokens, API keys, webhook URLs).

The encryption key is supplied by the Electron main process via the
``REPO_RADAR_SECRET_KEY`` environment variable (base64 of 32 random bytes). The
main process keeps that key encrypted on disk with the OS keyring through
Electron ``safeStorage``; the backend only ever sees the decrypted key in
memory for the lifetime of the process.

Design notes:
- Ciphertext is tagged with the ``enc:v1:`` prefix so reads can tell encrypted
  values from legacy plaintext and decrypt only when needed (seamless migration:
  old plaintext is returned as-is and re-encrypted on the next save).
- When no key is available (raw ``uvicorn`` dev runs, tests, or a platform
  without ``safeStorage``) encryption degrades to plaintext, preserving the
  previous behaviour instead of failing.
"""

from __future__ import annotations

import base64
import os

try:
    from cryptography.fernet import Fernet, InvalidToken

    _CRYPTO_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - exercised only without the dep
    Fernet = None  # type: ignore[assignment, misc]
    InvalidToken = Exception  # type: ignore[assignment, misc]
    _CRYPTO_AVAILABLE = False

_PREFIX = "enc:v1:"

# Cache the Fernet instance keyed by the raw key string so we build it once per
# key value (the env var is fixed for the process lifetime in practice).
_cached_key: str | None = None
_cached_fernet: Fernet | None = None


def _fernet() -> Fernet | None:
    """Return a Fernet built from REPO_RADAR_SECRET_KEY, or None when encryption
    is unavailable (missing key or missing cryptography dependency)."""
    global _cached_key, _cached_fernet

    raw = os.environ.get("REPO_RADAR_SECRET_KEY", "").strip()
    if not raw or not _CRYPTO_AVAILABLE:
        return None
    if raw == _cached_key and _cached_fernet is not None:
        return _cached_fernet

    try:
        key_bytes = base64.b64decode(raw)
    except (ValueError, TypeError):
        return None
    if len(key_bytes) < 32:
        return None

    fernet_key = base64.urlsafe_b64encode(key_bytes[:32])
    _cached_key = raw
    _cached_fernet = Fernet(fernet_key)
    return _cached_fernet


def encryption_enabled() -> bool:
    return _fernet() is not None


def encrypt_secret(value: str | None) -> str:
    """Encrypt a secret for persistence. Empty values stay empty; when no key is
    available the plaintext is returned unchanged (graceful degradation)."""
    text = str(value or "")
    if not text:
        return ""
    if text.startswith(_PREFIX):
        return text  # already encrypted, don't double-wrap
    fernet = _fernet()
    if fernet is None:
        return text
    return _PREFIX + fernet.encrypt(text.encode("utf-8")).decode("ascii")


def decrypt_secret(value: str | None) -> str:
    """Decrypt a stored secret. Non-prefixed (legacy plaintext) values are
    returned as-is; undecryptable ciphertext returns empty."""
    text = str(value or "")
    if not text or not text.startswith(_PREFIX):
        return text
    fernet = _fernet()
    if fernet is None:
        return ""
    try:
        return fernet.decrypt(text[len(_PREFIX) :].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""
