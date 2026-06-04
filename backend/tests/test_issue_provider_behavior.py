from __future__ import annotations

import unittest

from backend.core.issue_arrange import (
    is_filter_url,
    parse_filter_source_url,
    parse_issue_source_url,
)
from backend.core.report_service import build_dashboard


class IssueProviderBehaviorTests(unittest.TestCase):
    def test_github_issue_url_and_filter_url_are_parsed(self) -> None:
        provider, base_url, source_ref, number = parse_issue_source_url(
            "https://github.com/microsoft/markitdown/issues/2019"
        )
        self.assertEqual(
            ("github", "https://github.com", "microsoft/markitdown", 2019),
            (provider, base_url, source_ref, number),
        )

        filter_url = (
            "https://github.com/microsoft/markitdown/issues"
            "?q=is%3Aissue+state%3Aopen+label%3Abug"
        )
        self.assertTrue(is_filter_url(filter_url))
        parsed = parse_filter_source_url(filter_url)
        self.assertEqual("github", parsed[0])
        self.assertEqual("open", parsed[3]["state"])
        self.assertEqual("bug", parsed[3]["labels"])

    def test_missing_github_due_date_is_not_treated_as_near_due(self) -> None:
        dashboard = build_dashboard(
            [
                {
                    "iid": 1,
                    "provider": "github",
                    "source_ref": "owner/repo",
                    "title": "No due date",
                    "state": "opened",
                    "labels": [],
                    "assignees": [{"name": "Alice"}],
                    "due_date": None,
                    "milestone": None,
                    "updated_at": "2026-06-04T00:00:00Z",
                    "created_at": "2026-06-04T00:00:00Z",
                }
            ]
        )

        self.assertEqual(0, dashboard["summary"]["near_due_count"])


if __name__ == "__main__":
    unittest.main()
