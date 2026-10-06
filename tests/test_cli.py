import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


FAKE_CODEX = f'''#!{sys.executable}
import json, os, sys

if sys.argv[1:] == ["login", "status"]:
    print(os.environ.get("FAKE_LOGIN_OUTPUT", "Logged in using ChatGPT"), file=sys.stderr)
    raise SystemExit(int(os.environ.get("FAKE_LOGIN_EXIT_CODE", "0")))

if sys.argv[1:] == ["app-server", "--listen", "stdio://"]:
    marker = os.environ.get("FAKE_APP_SERVER_MARKER")
    if marker:
        open(marker, "w").close()
    for line in sys.stdin:
        request = json.loads(line)
        method = request.get("method")
        if method == "initialize":
            response = {{"id": request["id"], "result": {{}}}}
        elif method == "account/rateLimits/read":
            if os.environ.get("FAKE_RPC_NOTIFICATION"):
                print(json.dumps({{"method": "account/rateLimits/updated", "params": {{}}}}), flush=True)
            if os.environ.get("FAKE_RPC_ERROR"):
                response = {{"id": request["id"], "error": {{"message": "private diagnostic detail"}}}}
            else:
                response = {{"id": request["id"], "result": json.loads(os.environ["FAKE_RATE_LIMITS"])}}
        else:
            continue
        print(json.dumps(response), flush=True)
    raise SystemExit(0)

raise SystemExit(2)
'''


class ProviderCliTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.temp_path = Path(self.tempdir.name)
        self.codex = self.temp_path / "codex"
        self.codex.write_text(FAKE_CODEX)
        self.codex.chmod(0o755)
        self.marker = self.temp_path / "app-server-started"
        self.env = os.environ.copy()
        self.env.update(
            {
                "CODEX_BIN": str(self.codex),
                "FAKE_APP_SERVER_MARKER": str(self.marker),
                "FAKE_RATE_LIMITS": json.dumps(
                    {
                        "rateLimitsByLimitId": {
                            "codex": {
                                "planType": "plus",
                                "primary": {"usedPercent": 20, "windowDurationMins": 300},
                                "secondary": {"usedPercent": 50, "windowDurationMins": 10080},
                            }
                        }
                    }
                ),
            }
        )

    def run_provider(self):
        result = subprocess.run(
            [str(ROOT / "bin" / "codexstatus")],
            capture_output=True,
            text=True,
            env=self.env,
            timeout=10,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_provider_cli_reads_login_and_quota_from_codex_tools(self):
        self.env["FAKE_RPC_NOTIFICATION"] = "1"
        result = self.run_provider()

        self.assertEqual(result["auth"], {"state": "signed_in", "method": "chatgpt"})
        self.assertEqual(result["usage"]["state"], "available")
        self.assertEqual(result["usage"]["primary"]["remainingPercent"], 80)
        self.assertEqual(result["usage"]["secondary"]["remainingPercent"], 50)
        self.assertTrue(self.marker.exists())

    def test_provider_skips_quota_query_when_signed_out(self):
        self.env["FAKE_LOGIN_OUTPUT"] = "Not logged in"
        self.env["FAKE_LOGIN_EXIT_CODE"] = "1"

        result = self.run_provider()

        self.assertEqual(result["auth"]["state"], "signed_out")
        self.assertEqual(result["usage"]["state"], "unavailable")
        self.assertFalse(self.marker.exists())

    def test_unrecognized_login_failure_is_an_error_and_skips_quota(self):
        self.env["FAKE_LOGIN_OUTPUT"] = "Codex CLI could not read the local session"
        self.env["FAKE_LOGIN_EXIT_CODE"] = "1"

        result = self.run_provider()

        self.assertEqual(result["auth"], {"state": "error", "method": None})
        self.assertEqual(result["usage"]["state"], "unavailable")
        self.assertFalse(self.marker.exists())

    def test_api_key_login_does_not_claim_chatgpt_usage(self):
        self.env["FAKE_LOGIN_OUTPUT"] = "Logged in using an API key - sk-abcd***xyz"

        result = self.run_provider()

        self.assertEqual(result["auth"]["method"], "api_key")
        self.assertEqual(result["usage"]["state"], "unavailable")
        self.assertNotIn("sk-abcd", json.dumps(result))
        self.assertFalse(self.marker.exists())

    def test_missing_codex_executable_is_a_status_error(self):
        self.env["CODEX_BIN"] = str(self.temp_path / "missing-codex")

        result = self.run_provider()

        self.assertEqual(result["auth"]["state"], "error")
        self.assertEqual(result["usage"]["state"], "unavailable")
        self.assertIn("checkedAt", result)

    def test_app_server_error_is_reported_without_raw_diagnostic(self):
        self.env["FAKE_RPC_ERROR"] = "1"

        result = self.run_provider()

        self.assertEqual(result["usage"]["state"], "error")
        self.assertNotIn("private diagnostic detail", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
