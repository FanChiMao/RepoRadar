from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app as api_app  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

# TestClient without a `with` block does not run the lifespan, so the scheduler
# thread never starts — we only exercise the HTTP middleware here.
client = TestClient(api_app.app)


class SessionTokenEnforcedTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = patch.object(api_app, "SESSION_TOKEN", "secret-token")
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_health_is_exempt(self) -> None:
        self.assertEqual(200, client.get("/api/health").status_code)

    def test_missing_token_is_rejected(self) -> None:
        response = client.get("/api/config")
        self.assertEqual(401, response.status_code)
        self.assertEqual("Invalid session.", response.json()["detail"])

    def test_wrong_token_is_rejected(self) -> None:
        response = client.get("/api/config", headers={"X-Session-Token": "nope"})
        self.assertEqual(401, response.status_code)

    def test_correct_token_passes(self) -> None:
        response = client.get(
            "/api/config", headers={"X-Session-Token": "secret-token"}
        )
        self.assertEqual(200, response.status_code)


class SessionTokenDisabledTests(unittest.TestCase):
    def test_no_enforcement_when_token_unset(self) -> None:
        with patch.object(api_app, "SESSION_TOKEN", ""):
            self.assertEqual(200, client.get("/api/config").status_code)


if __name__ == "__main__":
    unittest.main()
