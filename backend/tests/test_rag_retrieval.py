from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402
from core import rag_service  # noqa: E402


def _chunk(
    chunk_id: str,
    issue_iid: int,
    tokens: list[str],
    *,
    source_type: str = "overview",
    text: str = "",
    updated_at: str = "2026-06-01T00:00:00Z",
) -> dict:
    return {
        "chunk_id": chunk_id,
        "issue_iid": issue_iid,
        "title": f"Issue {issue_iid}",
        "text": text or " ".join(tokens),
        "source_type": source_type,
        "tokens": tokens,
        "token_freq": {t: tokens.count(t) for t in set(tokens)},
        "metadata": {
            "state": "opened",
            "labels": [],
            "assignees": [],
            "updated_at": updated_at,
            "discussion_id": None,
            "note_ids": [],
            "web_url": f"https://example.com/issues/{issue_iid}",
        },
    }


class ResolveRetrievalModeTests(unittest.TestCase):
    def test_explicit_mode_passes_through(self) -> None:
        self.assertEqual(
            api_app.resolve_retrieval_mode("anything", "fast-rag"), "fast-rag"
        )
        self.assertEqual(
            api_app.resolve_retrieval_mode("anything", "context-trace"),
            "context-trace",
        )

    def test_invalid_mode_falls_back_to_auto_routing(self) -> None:
        # Unknown mode -> treated as auto -> routed by keywords.
        self.assertEqual(
            api_app.resolve_retrieval_mode("找 API key 錯誤", "bogus"), "fast-rag"
        )

    def test_auto_routes_context_trace_on_keywords(self) -> None:
        for q in [
            "PackageManager offline install 目前卡在哪？",
            "這個 bug 的root cause是什麼",
            "Why was it reverted",
        ]:
            self.assertEqual(
                api_app.resolve_retrieval_mode(q, "auto"), "context-trace", q
            )

    def test_auto_routes_fast_rag_by_default(self) -> None:
        self.assertEqual(
            api_app.resolve_retrieval_mode("找 DIT_SERVICE_API_KEY 相關錯誤", "auto"),
            "fast-rag",
        )


class Bm25ScoringTests(unittest.TestCase):
    def _stats(self, chunks: list[dict]) -> tuple[dict, float]:
        return rag_service._compute_corpus_stats(chunks)

    def test_rare_token_scores_higher_than_common_token(self) -> None:
        rare = _chunk("c1", 1, ["dit_service_api_key", "error"])
        common = _chunk("c2", 2, ["error", "error", "error"])
        chunks = [rare, common]
        doc_freq, avg_len = self._stats(chunks)

        rare_score = rag_service._chunk_score(
            rare,
            ["dit_service_api_key"],
            [],
            doc_freq=doc_freq,
            avg_len=avg_len,
            total_docs=len(chunks),
        )
        # "error" appears in both docs -> low idf; a unique token should beat it.
        common_score = rag_service._chunk_score(
            common,
            ["error"],
            [],
            doc_freq=doc_freq,
            avg_len=avg_len,
            total_docs=len(chunks),
        )
        self.assertGreater(rare_score, common_score)

    def test_iid_hit_dominates(self) -> None:
        chunk = _chunk("c1", 123, ["unrelated"])
        doc_freq, avg_len = self._stats([chunk])
        with_hit = rag_service._chunk_score(
            chunk, [], [123], doc_freq=doc_freq, avg_len=avg_len, total_docs=1
        )
        without_hit = rag_service._chunk_score(
            chunk, [], [999], doc_freq=doc_freq, avg_len=avg_len, total_docs=1
        )
        self.assertGreaterEqual(with_hit - without_hit, 10.0)


class SearchDiversityTests(unittest.TestCase):
    def _index(self, chunks: list[dict]) -> dict:
        doc_freq, avg_len = rag_service._compute_corpus_stats(chunks)
        return {
            "chunks": chunks,
            "doc_freq": doc_freq,
            "avg_chunk_tokens": avg_len,
        }

    def test_caps_chunks_per_issue(self) -> None:
        # Issue 1 has 4 matching chunks; issue 2 has 1. Cap should keep <=2 from issue 1.
        chunks = [
            _chunk(f"a{i}", 1, ["alpha", "beta"], source_type="discussion")
            for i in range(4)
        ]
        chunks.append(_chunk("b0", 2, ["alpha"]))
        index = self._index(chunks)

        with patch.object(rag_service, "load_rag_index", return_value=index):
            results = rag_service.search_rag_index("alpha beta", top_k=8)

        per_issue: dict[int, int] = {}
        for item in results:
            per_issue[item["issue_iid"]] = per_issue.get(item["issue_iid"], 0) + 1
        self.assertLessEqual(per_issue.get(1, 0), 2)
        self.assertIn(2, per_issue)

    def test_iid_query_exempts_cap(self) -> None:
        chunks = [
            _chunk(f"a{i}", 7, ["alpha"], source_type="discussion") for i in range(4)
        ]
        index = self._index(chunks)
        with patch.object(rag_service, "load_rag_index", return_value=index):
            results = rag_service.search_rag_index("#7 alpha", top_k=8)
        iid7 = [r for r in results if r["issue_iid"] == 7]
        self.assertGreater(len(iid7), 2)


class CollectIssueContextTests(unittest.TestCase):
    def test_orders_by_issue_then_source_type(self) -> None:
        chunks = [
            _chunk("i1-link", 1, ["x"], source_type="issue_link"),
            _chunk("i1-disc", 1, ["x"], source_type="discussion"),
            _chunk("i1-over", 1, ["x"], source_type="overview"),
            _chunk("i1-change", 1, ["x"], source_type="related_change"),
            _chunk("i2-over", 2, ["x"], source_type="overview"),
        ]
        index = {"chunks": chunks}
        with patch.object(rag_service, "load_rag_index", return_value=index):
            collected = rag_service.collect_issue_context([1, 2])

        order = [c["source_type"] for c in collected if c["issue_iid"] == 1]
        self.assertEqual(
            order, ["overview", "discussion", "related_change", "issue_link"]
        )
        # Issue order follows the requested iid order.
        self.assertEqual(collected[0]["issue_iid"], 1)
        self.assertEqual(collected[-1]["issue_iid"], 2)

    def test_empty_input_returns_empty(self) -> None:
        self.assertEqual(rag_service.collect_issue_context([]), [])


class ContextTraceCandidateTests(unittest.TestCase):
    def test_falls_back_to_risk_issue_candidates_when_search_misses(self) -> None:
        index = {
            "chunks": [
                _chunk("i1-over", 1, ["alpha"], source_type="overview"),
                _chunk("i2-over", 2, ["beta"], source_type="overview"),
            ]
        }
        issues = [
            {
                "iid": 1,
                "title": "Low priority cleanup",
                "state": "opened",
                "labels": [],
                "updated_at": "2026-06-08T00:00:00Z",
                "due_date": "2026-07-30",
            },
            {
                "iid": 2,
                "title": "Release blocker",
                "state": "opened",
                "labels": [],
                "updated_at": "2026-04-01T00:00:00Z",
                "due_date": "2026-06-12",
            },
        ]

        picked = api_app.select_context_trace_issue_iids(
            "本週最主要的風險是什麼",
            [],
            issues,
            index,
            top_n=1,
        )

        self.assertEqual([2], picked)


if __name__ == "__main__":
    unittest.main()
