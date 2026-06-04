from __future__ import annotations

import shutil
import sys
import unittest
import uuid
from pathlib import Path
from unittest.mock import Mock, patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402
from core import config_store  # noqa: E402


class ProviderApiTests(unittest.TestCase):
    def runtime_dir(self) -> Path:
        path = BACKEND_DIR / "data" / f"test-api-{uuid.uuid4().hex}"
        path.mkdir(parents=True)
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def test_config_route_masks_secrets_and_clears_source_specific_caches(self) -> None:
        runtime = self.runtime_dir()
        config_path = runtime / "config.json"
        cache_path = runtime / "issues_cache.json"
        meta_path = runtime / "meta.json"
        rag_index_path = runtime / "rag_index.json"
        rag_jobs_path = runtime / "rag_rebuild_jobs.json"

        patches = [
            patch.object(config_store, "CONFIG_PATH", config_path),
            patch.object(config_store, "META_PATH", meta_path),
            patch.object(api_app, "CACHE_PATH", cache_path),
            patch.object(api_app, "RAG_INDEX_PATH", rag_index_path),
            patch.object(api_app, "RAG_JOB_STATE_PATH", rag_jobs_path),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

        response = api_app.post_config(
            api_app.ConfigPayload(
                active_provider="github",
                connections={
                    "github": {
                        "base_url": "https://github.com",
                        "token": "secret",
                        "project_ref": "microsoft/markitdown",
                    }
                },
            )
        )

        self.assertEqual("", response["connections"]["github"]["token"])
        self.assertTrue(response["connections"]["github"]["token_configured"])
        self.assertEqual([], config_store.read_json(cache_path, None))
        self.assertEqual({}, config_store.read_json(rag_index_path, None))

    def test_connection_route_uses_payload_without_persisting_it(self) -> None:
        provider = Mock()
        provider.test_connection.return_value = {
            "provider": "github",
            "source_ref": "microsoft/markitdown",
        }
        with (
            patch.object(
                api_app, "load_config", return_value=config_store._normalize_config({})
            ),
            patch.object(
                api_app, "create_provider", return_value=provider
            ) as create_provider,
            patch.object(api_app, "save_config") as save_config,
        ):
            result = api_app.test_connection(
                api_app.ConnectionTestPayload(
                    provider="github",
                    base_url="https://github.com",
                    token="new-secret",
                    project_ref="microsoft/markitdown",
                )
            )

        self.assertEqual("microsoft/markitdown", result["source_ref"])
        self.assertEqual(
            "new-secret",
            create_provider.call_args.args[0]["connections"]["github"]["token"],
        )
        save_config.assert_not_called()

    def test_second_sync_marks_new_comments_without_repeating_the_flag(self) -> None:
        runtime = self.runtime_dir()
        cache_path = runtime / "issues_cache.json"
        meta_path = runtime / "meta.json"
        provider = Mock()
        provider.provider_name = "github"
        provider.fetch_project_issues.side_effect = [
            [{"iid": 2019, "user_notes_count": 1}],
            [{"iid": 2019, "user_notes_count": 2}],
            [{"iid": 2019, "user_notes_count": 2}],
        ]
        config = config_store._normalize_config(
            {
                "active_provider": "github",
                "connections": {
                    "github": {
                        "base_url": "https://github.com",
                        "project_ref": "microsoft/markitdown",
                    }
                },
            }
        )

        with (
            patch.object(api_app, "CACHE_PATH", cache_path),
            patch.object(config_store, "META_PATH", meta_path),
            patch.object(api_app, "load_config", return_value=config),
            patch.object(
                api_app,
                "active_provider_context",
                return_value=(provider, "microsoft/markitdown"),
            ),
        ):
            api_app.fetch_issues()
            second = api_app.fetch_issues()
            third = api_app.fetch_issues()

        self.assertTrue(second[0]["has_new_discussions"])
        self.assertFalse(third[0]["has_new_discussions"])


if __name__ == "__main__":
    unittest.main()
