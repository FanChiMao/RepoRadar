from __future__ import annotations

import json
import shutil
import unittest
import uuid
from pathlib import Path
from unittest.mock import patch

from backend.core import config_store
from backend.core.provider import get_connection, source_identity


class ConfigStoreTests(unittest.TestCase):
    def runtime_dir(self) -> Path:
        path = Path(__file__).resolve().parents[1] / "data" / f"test-{uuid.uuid4().hex}"
        path.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def test_legacy_flat_gitlab_config_is_migrated(self) -> None:
        path = self.runtime_dir() / "config.json"
        path.write_text(
            json.dumps(
                {
                    "gitlab_url": "https://gitlab.example",
                    "token": "secret",
                    "project_ref": "group/repo",
                    "project_ref_history": ["group/repo"],
                }
            ),
            encoding="utf-8",
        )
        with patch.object(config_store, "CONFIG_PATH", path):
            config = config_store.load_config()

        self.assertEqual("gitlab", config["active_provider"])
        self.assertEqual("group/repo", get_connection(config)["project_ref"])
        self.assertEqual("secret", get_connection(config)["token"])

    def test_public_config_masks_all_secrets_and_save_preserves_blank_secret(
        self,
    ) -> None:
        path = self.runtime_dir() / "config.json"
        with patch.object(config_store, "CONFIG_PATH", path):
            config_store.save_config(
                {
                    "active_provider": "github",
                    "connections": {
                        "github": {
                            "base_url": "https://github.com",
                            "token": "github-secret",
                            "project_ref": "microsoft/markitdown",
                        }
                    },
                    "gemini_api_key": "gemini-secret",
                }
            )
            saved = config_store.save_config(
                {
                    "active_provider": "github",
                    "connections": {
                        "github": {
                            "base_url": "https://github.com",
                            "token": "",
                            "project_ref": "microsoft/markitdown",
                        }
                    },
                    "gemini_api_key": "",
                }
            )
            public = config_store.public_config(saved)

        self.assertEqual("github-secret", get_connection(saved)["token"])
        self.assertEqual("", public["connections"]["github"]["token"])
        self.assertTrue(public["connections"]["github"]["token_configured"])
        self.assertEqual("", public["gemini_api_key"])
        self.assertTrue(public["gemini_api_key_configured"])
        self.assertEqual(
            "github:https://github.com:microsoft/markitdown", source_identity(saved)
        )

    def test_secrets_encrypted_at_rest_when_key_present(self) -> None:
        import base64

        path = self.runtime_dir() / "config.json"
        key = base64.b64encode(b"k" * 32).decode("ascii")
        with (
            patch.object(config_store, "CONFIG_PATH", path),
            patch.dict("os.environ", {"REPO_RADAR_SECRET_KEY": key}),
        ):
            config_store.save_config(
                {
                    "active_provider": "gitlab",
                    "connections": {
                        "gitlab": {
                            "base_url": "https://gitlab.example",
                            "token": "glpat-secret",
                            "project_ref": "group/repo",
                        }
                    },
                    "gemini_api_key": "gemini-secret",
                }
            )
            on_disk = path.read_text(encoding="utf-8")
            reloaded = config_store.load_config()

        # The raw file must not contain plaintext secrets.
        self.assertNotIn("glpat-secret", on_disk)
        self.assertNotIn("gemini-secret", on_disk)
        self.assertIn("enc:v1:", on_disk)
        # Loading transparently decrypts back to plaintext.
        self.assertEqual("glpat-secret", get_connection(reloaded)["token"])
        self.assertEqual("gemini-secret", reloaded["gemini_api_key"])


if __name__ == "__main__":
    unittest.main()
