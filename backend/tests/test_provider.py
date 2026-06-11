from __future__ import annotations

import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import provider as provider_mod  # noqa: E402
from core.github_client import GitHubIssueProvider  # noqa: E402
from core.gitlab_client import GitLabIssueClient  # noqa: E402


class NormalizeProviderNameTests(unittest.TestCase):
    def test_defaults_to_gitlab(self) -> None:
        self.assertEqual("gitlab", provider_mod.normalize_provider_name(None))
        self.assertEqual("gitlab", provider_mod.normalize_provider_name(""))

    def test_normalizes_case_and_whitespace(self) -> None:
        self.assertEqual("github", provider_mod.normalize_provider_name("  GitHub "))

    def test_rejects_unknown_provider(self) -> None:
        with self.assertRaises(ValueError):
            provider_mod.normalize_provider_name("bitbucket")


class GetConnectionTests(unittest.TestCase):
    def test_uses_active_provider_and_strips_fields(self) -> None:
        config = {
            "active_provider": "gitlab",
            "connections": {
                "gitlab": {
                    "base_url": "https://gitlab.example.com/ ",
                    "token": "  tok ",
                    "project_ref": " group/app ",
                }
            },
        }
        conn = provider_mod.get_connection(config)
        self.assertEqual("gitlab", conn["provider"])
        self.assertEqual("https://gitlab.example.com", conn["base_url"])
        self.assertEqual("tok", conn["token"])
        self.assertEqual("group/app", conn["project_ref"])
        self.assertFalse(conn["verify_ssl"])

    def test_github_defaults_verify_ssl_true(self) -> None:
        conn = provider_mod.get_connection({}, provider="github")
        self.assertEqual("github", conn["provider"])
        self.assertTrue(conn["verify_ssl"])
        self.assertEqual([], conn["project_ref_history"])

    def test_explicit_provider_overrides_active(self) -> None:
        config = {"active_provider": "gitlab", "connections": {}}
        conn = provider_mod.get_connection(config, provider="github")
        self.assertEqual("github", conn["provider"])


class SourceIdentityTests(unittest.TestCase):
    def test_import_file_takes_precedence(self) -> None:
        self.assertEqual(
            "import:dump.json",
            provider_mod.source_identity({"import_file": "dump.json"}),
        )

    def test_derives_from_connection(self) -> None:
        config = {
            "active_provider": "github",
            "connections": {
                "github": {"base_url": "https://github.com", "project_ref": "a/b"}
            },
        }
        self.assertEqual(
            "github:https://github.com:a/b", provider_mod.source_identity(config)
        )


class CreateProviderTests(unittest.TestCase):
    def test_creates_github_provider_with_default_base_url(self) -> None:
        instance = provider_mod.create_provider({}, provider="github")
        self.assertIsInstance(instance, GitHubIssueProvider)

    def test_creates_gitlab_provider_when_configured(self) -> None:
        config = {
            "active_provider": "gitlab",
            "connections": {
                "gitlab": {
                    "base_url": "https://gitlab.example.com",
                    "token": "tok",
                }
            },
        }
        instance = provider_mod.create_provider(config)
        self.assertIsInstance(instance, GitLabIssueClient)

    def test_gitlab_requires_base_url_and_token(self) -> None:
        with self.assertRaises(ValueError):
            provider_mod.create_provider({"active_provider": "gitlab"})


class ActiveProviderContextTests(unittest.TestCase):
    def test_requires_project_ref(self) -> None:
        with self.assertRaises(ValueError):
            provider_mod.active_provider_context({"active_provider": "github"})

    def test_returns_provider_and_ref(self) -> None:
        config = {
            "active_provider": "github",
            "connections": {"github": {"project_ref": "a/b"}},
        }
        instance, ref = provider_mod.active_provider_context(config)
        self.assertIsInstance(instance, GitHubIssueProvider)
        self.assertEqual("a/b", ref)


if __name__ == "__main__":
    unittest.main()
