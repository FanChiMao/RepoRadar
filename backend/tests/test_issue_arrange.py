from __future__ import annotations

import sys
import unittest
from datetime import datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from core import issue_arrange as ia  # noqa: E402


class DetectProviderTests(unittest.TestCase):
    def test_github_hosts(self) -> None:
        self.assertEqual(
            "github", ia.detect_provider_from_url("https://github.com/a/b")
        )
        self.assertEqual(
            "github", ia.detect_provider_from_url("https://www.github.com/a/b")
        )

    def test_defaults_to_gitlab(self) -> None:
        self.assertEqual(
            "gitlab", ia.detect_provider_from_url("https://gitlab.example.com/a/b")
        )


class ParseIssueSourceUrlTests(unittest.TestCase):
    def test_github_issue(self) -> None:
        result = ia.parse_issue_source_url("https://github.com/owner/repo/issues/42")
        self.assertEqual(("github", "https://github.com", "owner/repo", 42), result)

    def test_github_non_issue_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_source_url("https://github.com/owner/repo/pull/42")

    def test_github_non_numeric_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_source_url("https://github.com/owner/repo/issues/abc")

    def test_gitlab_issue(self) -> None:
        result = ia.parse_issue_source_url(
            "https://gitlab.example.com/group/project/-/issues/7"
        )
        self.assertEqual(
            ("gitlab", "https://gitlab.example.com", "group/project", 7), result
        )

    def test_invalid_scheme_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_source_url("ftp://github.com/a/b/issues/1")


class ParseGitlabIssueUrlTests(unittest.TestCase):
    def test_work_items_path(self) -> None:
        _, ref, iid = ia.parse_issue_url(
            "https://gitlab.example.com/group/sub/project/-/work_items/9"
        )
        self.assertEqual("group/sub/project", ref)
        self.assertEqual(9, iid)

    def test_missing_marker_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_url("https://gitlab.example.com/group/project/issues/7")

    def test_non_issue_kind_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_url("https://gitlab.example.com/group/project/-/merge/7")

    def test_non_numeric_iid_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_url("https://gitlab.example.com/group/project/-/issues/x")

    def test_invalid_scheme_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_issue_url("notaurl")


class FilterUrlDetectionTests(unittest.TestCase):
    def test_github_filter_url(self) -> None:
        self.assertTrue(
            ia.is_filter_url("https://github.com/owner/repo/issues?q=is%3Aopen")
        )

    def test_github_issue_without_query_is_not_filter(self) -> None:
        self.assertFalse(ia.is_filter_url("https://github.com/owner/repo/issues/1"))

    def test_gitlab_filter_url(self) -> None:
        self.assertTrue(
            ia.is_filter_url("https://gitlab.example.com/g/p/-/issues?state=opened")
        )


class ParseFilterSourceUrlTests(unittest.TestCase):
    def test_github_filter_extracts_state_labels_assignee(self) -> None:
        provider, base, ref, params, labels, or_labels, not_labels = (
            ia.parse_filter_source_url(
                'https://github.com/owner/repo/issues?q=is%3Aopen+label%3A"good first issue"+assignee%3Aoctocat'
            )
        )
        self.assertEqual("github", provider)
        self.assertEqual("owner/repo", ref)
        self.assertEqual("open", params["state"])
        self.assertEqual("octocat", params["assignee"])
        self.assertIn("good first issue", params["labels"])

    def test_github_labels_query_param(self) -> None:
        result = ia.parse_filter_source_url(
            "https://github.com/owner/repo/issues?labels=bug,ui&state=closed"
        )
        params = result[3]
        self.assertEqual("closed", params["state"])
        self.assertEqual("bug,ui", params["labels"])

    def test_github_invalid_filter_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_filter_source_url("https://github.com/owner/repo/pulls?q=x")

    def test_gitlab_filter(self) -> None:
        provider, base, ref, params, labels, or_labels, not_labels = (
            ia.parse_filter_source_url(
                "https://gitlab.example.com/g/p/-/issues?state=opened"
                "&milestone_title=v1&assignee_username=dev&label_name[]=bug"
            )
        )
        self.assertEqual("gitlab", provider)
        self.assertEqual("g/p", ref)
        self.assertEqual("opened", params["state"])
        self.assertEqual("v1", params["milestone"])
        self.assertEqual("dev", params["assignee_username"])
        self.assertEqual(["bug"], labels)

    def test_gitlab_filter_missing_marker_raises(self) -> None:
        with self.assertRaises(ValueError):
            ia.parse_filter_url("https://gitlab.example.com/?state=opened")


class FormatIssuePreviewTests(unittest.TestCase):
    def test_includes_milestone_when_present(self) -> None:
        preview = ia.format_issue_preview(
            {
                "iid": 1,
                "title": "T",
                "assignees": [{"name": "A"}, {"name": None}],
                "milestone": {"title": "M", "due_date": "2026-01-01"},
                "labels": ["bug"],
            }
        )
        self.assertEqual(["A"], preview["assignees"])
        self.assertEqual({"title": "M", "due_date": "2026-01-01"}, preview["milestone"])

    def test_milestone_none_when_no_title(self) -> None:
        preview = ia.format_issue_preview({"iid": 1, "milestone": {}})
        self.assertIsNone(preview["milestone"])


class FmtDtTests(unittest.TestCase):
    def test_empty(self) -> None:
        self.assertEqual("", ia._fmt_dt(None))

    def test_iso_with_z(self) -> None:
        self.assertEqual("2026-06-11 08:30", ia._fmt_dt("2026-06-11T08:30:00Z"))

    def test_fallback_for_unparseable(self) -> None:
        # falls back to raw[:16] with the ISO 'T' replaced by a space
        self.assertEqual("2026-06-11 99:99", ia._fmt_dt("2026-06-11T99:99:99"))


class BuildIssueRawTextTests(unittest.TestCase):
    def test_includes_meta_and_notes(self) -> None:
        text = ia.build_issue_raw_text(
            {
                "iid": 5,
                "title": "Bug",
                "state": "opened",
                "author": {"name": "Dev"},
                "created_at": "2026-06-01T00:00:00Z",
                "assignees": [{"name": "A"}],
                "labels": ["bug"],
                "milestone": {"title": "v1", "due_date": "2026-07-01"},
                "due_date": "2026-06-30",
            },
            [
                {
                    "notes": [
                        {
                            "body": "first",
                            "author_name": "X",
                            "created_at": "2026-06-02T10:00:00Z",
                        }
                    ]
                },
                {"notes": [{"body": "  ", "author_name": "Y"}]},
            ],
        )
        self.assertIn("# #5 Bug", text)
        self.assertIn("**狀態**：opened", text)
        self.assertIn("留言（共 1 則）", text)
        self.assertIn("first", text)

    def test_no_notes_renders_placeholder(self) -> None:
        text = ia.build_issue_raw_text({"iid": 1, "title": "T"}, [])
        self.assertIn("（無留言）", text)


class FormatDurationTests(unittest.TestCase):
    def test_zero_or_none(self) -> None:
        self.assertEqual("", ia.format_duration(None))
        self.assertEqual("", ia.format_duration(0))

    def test_minutes_only(self) -> None:
        self.assertEqual("30m", ia.format_duration(1800))

    def test_hours_and_minutes(self) -> None:
        self.assertEqual("1h 30m", ia.format_duration(5400))


class ParseLabelsTests(unittest.TestCase):
    def test_priority_tags_epics_and_teams(self) -> None:
        parsed = ia.parse_labels(
            [
                "Priority::High",
                "Bug",
                "Epics:Login",
                "Team::Frontend",
                "Team::UI/UX Design",
                "UI Done",
                "UX Done",
                "Random",
            ]
        )
        self.assertEqual("High", parsed["priority"])
        self.assertEqual("Bug", parsed["tags"])
        self.assertEqual("Login", parsed["epics"])
        self.assertEqual("0%", parsed["FE"])
        self.assertEqual("Done", parsed["UI/UX"])
        self.assertIn("Random", parsed["other_labels"])
        self.assertNotIn("Bug", parsed["other_labels"])


class BuildExcelRowTests(unittest.TestCase):
    def test_maps_fields(self) -> None:
        row = ia.build_excel_row(
            {
                "iid": 3,
                "title": "T",
                "state": "opened",
                "labels": ["Priority::Low", "Team::Backend"],
                "assignees": [{"name": "A"}],
                "author": {"name": "Auth"},
                "created_at": "2026-06-01T00:00:00Z",
                "milestone": {"title": "v1"},
                "time_stats": {"time_estimate": 3600, "total_time_spent": 1800},
                "web_url": "https://x/issues/3",
            }
        )
        self.assertEqual(3, row["Issue ID"])
        self.assertEqual("Low", row["Priority"])
        self.assertEqual("0%", row["BE"])
        self.assertEqual("1h 00m", row["Time Estimate"])
        self.assertEqual("30m", row["Time Spent"])
        self.assertEqual("2026-06-01 00:00", row["Created At"])


class FormatExcelDatetimeTests(unittest.TestCase):
    def test_empty(self) -> None:
        self.assertEqual("", ia.format_excel_datetime(None))

    def test_z_suffix(self) -> None:
        self.assertEqual(
            "2026-06-11 08:30", ia.format_excel_datetime("2026-06-11T08:30:00Z")
        )

    def test_invalid_passthrough(self) -> None:
        self.assertEqual("nope", ia.format_excel_datetime("nope"))


class ArchiveHelperTests(unittest.TestCase):
    def test_sanitize_archive_part(self) -> None:
        self.assertEqual("a-b-c", ia._sanitize_archive_part("a/b\\c"))
        self.assertEqual("unknown", ia._sanitize_archive_part("   "))

    def test_archive_repo_name_uses_last_segment(self) -> None:
        self.assertEqual("project", ia._archive_repo_name("group/project"))

    def test_archive_repo_name_skips_gitlab_profile(self) -> None:
        self.assertEqual("group", ia._archive_repo_name("group/gitlab-profile"))

    def test_archive_repo_name_empty(self) -> None:
        self.assertEqual("unknown-repo", ia._archive_repo_name(""))

    def test_build_arrange_archive_filename(self) -> None:
        name = ia.build_arrange_archive_filename(
            "https://gitlab.example.com/group/project/-/issues/7",
            kind="result",
            model_name="gpt-4o",
            now=datetime(2026, 6, 11, 8, 30, 0),
        )
        self.assertEqual("issue_7_model-gpt-4o_20260611_083000.md", name)

    def test_build_arrange_archive_filename_scrape(self) -> None:
        name = ia.build_arrange_archive_filename(
            "https://gitlab.example.com/group/project/-/issues/7",
            kind="scrape",
            now=datetime(2026, 6, 11, 8, 30, 0),
        )
        self.assertEqual("issue_7_scrape_20260611_083000.md", name)


class ArchiveIoTests(unittest.TestCase):
    def runtime_dir(self) -> Path:
        import shutil
        import uuid

        path = BACKEND_DIR / "data" / f"test-arrange-{uuid.uuid4().hex}"
        self.addCleanup(shutil.rmtree, path, True)
        return path

    def test_save_arrange_output_writes_and_dedupes(self) -> None:
        base = self.runtime_dir()
        url = "https://gitlab.example.com/group/project/-/issues/7"
        first = ia.save_arrange_output(base, "a", "result", url, model_name="m")
        second = ia.save_arrange_output(base, "b", "result", url, model_name="m")
        self.assertTrue(first.exists())
        self.assertTrue(second.exists())
        self.assertNotEqual(first.name, second.name)

    def test_save_arrange_output_invalid_kind(self) -> None:
        with self.assertRaises(ValueError):
            ia.save_arrange_output(self.runtime_dir(), "x", "bogus", "url")

    def test_list_and_resolve_outputs(self) -> None:
        base = self.runtime_dir()
        url = "https://gitlab.example.com/group/project/-/issues/7"
        saved = ia.save_arrange_output(base, "content", "result", url, model_name="m")
        listing = ia.list_arrange_outputs(base)
        self.assertTrue(any(item["filename"] == saved.name for item in listing))

        path, kind = ia.resolve_arrange_output(base, saved.name)
        self.assertEqual(saved, path)
        self.assertEqual("result", kind)

    def test_resolve_invalid_filename(self) -> None:
        with self.assertRaises(ValueError):
            ia.resolve_arrange_output(self.runtime_dir(), "../evil")

    def test_resolve_missing_file(self) -> None:
        with self.assertRaises(FileNotFoundError):
            ia.resolve_arrange_output(self.runtime_dir(), "nope.md")


if __name__ == "__main__":
    unittest.main()
