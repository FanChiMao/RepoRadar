from __future__ import annotations

import base64
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import secrets  # noqa: E402

_KEY = base64.b64encode(b"0" * 32).decode("ascii")


def _with_key(value: str = _KEY):
    return patch.dict("os.environ", {"REPO_RADAR_SECRET_KEY": value})


def _without_key():
    env = dict(os.environ)
    env.pop("REPO_RADAR_SECRET_KEY", None)
    return patch.dict("os.environ", env, clear=True)


class EncryptionEnabledTests(unittest.TestCase):
    def test_enabled_with_valid_key(self) -> None:
        with _with_key():
            self.assertTrue(secrets.encryption_enabled())

    def test_disabled_without_key(self) -> None:
        with _without_key():
            self.assertFalse(secrets.encryption_enabled())

    def test_disabled_with_too_short_key(self) -> None:
        with _with_key(base64.b64encode(b"short").decode("ascii")):
            self.assertFalse(secrets.encryption_enabled())


class RoundTripTests(unittest.TestCase):
    def test_encrypt_then_decrypt(self) -> None:
        with _with_key():
            token = secrets.encrypt_secret("glpat-supersecret")
            self.assertTrue(token.startswith("enc:v1:"))
            self.assertNotIn("supersecret", token)
            self.assertEqual("glpat-supersecret", secrets.decrypt_secret(token))

    def test_empty_stays_empty(self) -> None:
        with _with_key():
            self.assertEqual("", secrets.encrypt_secret(""))
            self.assertEqual("", secrets.encrypt_secret(None))
            self.assertEqual("", secrets.decrypt_secret(""))

    def test_encrypt_is_idempotent_on_ciphertext(self) -> None:
        with _with_key():
            once = secrets.encrypt_secret("abc")
            twice = secrets.encrypt_secret(once)
            self.assertEqual(once, twice)
            self.assertEqual("abc", secrets.decrypt_secret(twice))


class FallbackAndMigrationTests(unittest.TestCase):
    def test_plaintext_passthrough_without_key(self) -> None:
        with _without_key():
            self.assertEqual("plain", secrets.encrypt_secret("plain"))
            self.assertEqual("plain", secrets.decrypt_secret("plain"))

    def test_legacy_plaintext_returned_as_is(self) -> None:
        # A value without the enc: prefix is treated as legacy plaintext.
        with _with_key():
            self.assertEqual("legacy-token", secrets.decrypt_secret("legacy-token"))

    def test_undecryptable_ciphertext_returns_empty(self) -> None:
        with _with_key():
            self.assertEqual("", secrets.decrypt_secret("enc:v1:not-a-valid-token"))

    def test_value_encrypted_with_other_key_returns_empty(self) -> None:
        other = base64.b64encode(b"1" * 32).decode("ascii")
        with _with_key(other):
            token = secrets.encrypt_secret("secret")
        with _with_key(_KEY):
            self.assertEqual("", secrets.decrypt_secret(token))


if __name__ == "__main__":
    unittest.main()
