import unittest

from codexstatus.provider import normalize_usage_response, parse_login_result


class LoginStatusParserTests(unittest.TestCase):
    def test_chatgpt_login_output_is_normalized(self):
        self.assertEqual(
            parse_login_result(0, "", "Logged in using ChatGPT"),
            {"state": "signed_in", "method": "chatgpt"},
        )

    def test_signed_out_status_is_distinct_from_an_error(self):
        self.assertEqual(
            parse_login_result(1, "", "Not logged in"),
            {"state": "signed_out", "method": None},
        )

    def test_api_key_output_does_not_leak_masked_key_fragment(self):
        self.assertEqual(
            parse_login_result(0, "", "Logged in using an API key - sk-abcd***xyz"),
            {"state": "signed_in", "method": "api_key"},
        )


class UsageResponseTests(unittest.TestCase):
    def test_codex_bucket_becomes_remaining_percent_and_utc_reset(self):
        result = normalize_usage_response(
            {
                "rateLimitsByLimitId": {
                    "codex": {
                        "planType": "plus",
                        "primary": {
                            "usedPercent": 35,
                            "windowDurationMins": 300,
                            "resetsAt": 100,
                        },
                        "secondary": None,
                    }
                },
                "rateLimits": {"limitId": "other", "primary": {"usedPercent": 99}},
            }
        )

        self.assertEqual(
            result,
            {
                "state": "available",
                "plan": "plus",
                "primary": {
                    "usedPercent": 35,
                    "remainingPercent": 65,
                    "windowDurationMins": 300,
                    "resetsAt": "1970-01-01T00:01:40Z",
                },
                "secondary": None,
            },
        )

    def test_legacy_codex_bucket_is_supported(self):
        result = normalize_usage_response(
            {"rateLimits": {"limitId": "codex", "planType": "pro", "primary": None}}
        )

        self.assertEqual(
            result,
            {"state": "available", "plan": "pro", "primary": None, "secondary": None},
        )

    def test_unreported_codex_bucket_is_unavailable_not_full_quota(self):
        result = normalize_usage_response(
            {"rateLimitsByLimitId": {"other": {"primary": {"usedPercent": 0}}}}
        )

        self.assertEqual(result["state"], "unavailable")
        self.assertIsNone(result["primary"])


if __name__ == "__main__":
    unittest.main()
