"""Read and normalize Codex CLI login and usage status."""

from __future__ import annotations

import json
import os
import select
import shutil
import subprocess
import time
from datetime import datetime, timezone
from typing import Any


def parse_login_result(returncode: int, stdout: str, stderr: str) -> dict[str, str | None]:
    """Normalize `codex login status` without returning credential fragments."""
    message = f"{stdout}\n{stderr}"
    if "Not logged in" in message:
        return {"state": "signed_out", "method": None}

    methods = (
        ("Logged in using ChatGPT", "chatgpt"),
        ("Logged in using an API key", "api_key"),
        ("Logged in using workload identity", "workload_identity"),
        ("Logged in using access token", "access_token"),
        ("Logged in using personal access token", "personal_access_token"),
        ("Logged in using Amazon Bedrock API key", "bedrock_api_key"),
        ("Logged in using Amazon Bedrock AWS access keys", "bedrock_access_keys"),
    )
    for label, method in methods:
        if label in message and returncode == 0:
            return {"state": "signed_in", "method": method}

    return {"state": "error", "method": None}


def _utc_timestamp(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        return datetime.fromtimestamp(value, timezone.utc).isoformat(timespec="seconds").replace(
            "+00:00", "Z"
        )
    except (OverflowError, OSError, ValueError):
        return None


def _normalize_window(value: Any) -> dict[str, Any] | None:
    if not isinstance(value, dict):
        return None
    used = value.get("usedPercent")
    if isinstance(used, bool) or not isinstance(used, (int, float)):
        return None
    used_percent = max(0, min(100, round(used)))
    duration = value.get("windowDurationMins")
    if isinstance(duration, bool) or not isinstance(duration, int) or duration < 0:
        duration = None
    return {
        "usedPercent": used_percent,
        "remainingPercent": 100 - used_percent,
        "windowDurationMins": duration,
        "resetsAt": _utc_timestamp(value.get("resetsAt")),
    }


def normalize_usage_response(response: Any) -> dict[str, Any]:
    """Convert the app-server response into the provider's stable, safe schema."""
    if not isinstance(response, dict):
        return {"state": "unavailable", "plan": None, "primary": None, "secondary": None}

    buckets = response.get("rateLimitsByLimitId")
    bucket = buckets.get("codex") if isinstance(buckets, dict) else None
    if bucket is None:
        legacy = response.get("rateLimits")
        if isinstance(legacy, dict) and legacy.get("limitId") in (None, "codex"):
            bucket = legacy

    if not isinstance(bucket, dict):
        return {"state": "unavailable", "plan": None, "primary": None, "secondary": None}

    return {
        "state": "available",
        "plan": bucket.get("planType") if isinstance(bucket.get("planType"), str) else None,
        "primary": _normalize_window(bucket.get("primary")),
        "secondary": _normalize_window(bucket.get("secondary")),
    }


class AppServerError(RuntimeError):
    """A sanitized app-server transport or RPC failure."""


def _read_response(
    process: subprocess.Popen[bytes],
    request_id: int,
    timeout: float,
    buffer: bytearray,
) -> dict[str, Any]:
    if process.stdout is None:
        raise AppServerError("app-server stdout is unavailable")
    output_fd = process.stdout.fileno()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        newline = buffer.find(b"\n")
        if newline >= 0:
            line = bytes(buffer[:newline])
            del buffer[: newline + 1]
            try:
                message = json.loads(line)
            except (json.JSONDecodeError, UnicodeDecodeError):
                continue
            if isinstance(message, dict) and message.get("id") == request_id:
                return message
            continue

        remaining = deadline - time.monotonic()
        if remaining <= 0:
            break
        ready, _, _ = select.select([output_fd], [], [], remaining)
        if not ready:
            break
        chunk = os.read(output_fd, 4096)
        if not chunk:
            break
        buffer.extend(chunk)
    raise AppServerError("Codex app-server did not answer in time")


def read_rate_limits(codex_binary: str, timeout: float = 12.0) -> dict[str, Any]:
    """Read one rate-limit snapshot using Codex app-server's stdio protocol."""
    try:
        process = subprocess.Popen(
            [codex_binary, "app-server", "--listen", "stdio://"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            bufsize=0,
        )
    except OSError as error:
        raise AppServerError("Could not start Codex app-server") from error

    try:
        if process.stdin is None:
            raise AppServerError("app-server stdin is unavailable")
        response_buffer = bytearray()
        initialize = {
            "id": 1,
            "method": "initialize",
            "params": {"clientInfo": {"name": "codexstatus", "version": "0.1.0"}},
        }
        process.stdin.write((json.dumps(initialize) + "\n").encode())
        process.stdin.flush()
        initialized = _read_response(process, 1, min(timeout, 5.0), response_buffer)
        if "error" in initialized:
            raise AppServerError("Codex app-server initialization failed")

        process.stdin.write((json.dumps({"method": "initialized", "params": {}}) + "\n").encode())
        request = {"id": 2, "method": "account/rateLimits/read", "params": {}}
        process.stdin.write((json.dumps(request) + "\n").encode())
        process.stdin.flush()
        response = _read_response(process, 2, timeout, response_buffer)
        if "error" in response or not isinstance(response.get("result"), dict):
            raise AppServerError("Codex app-server could not read usage")
        return response["result"]
    except (BrokenPipeError, OSError) as error:
        raise AppServerError("Codex app-server connection failed") from error
    finally:
        if process.stdin is not None and not process.stdin.closed:
            process.stdin.close()
        try:
            process.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            process.terminate()
            try:
                process.wait(timeout=0.5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=0.5)


def _find_codex_binary() -> str | None:
    configured = os.environ.get("CODEX_BIN")
    if configured:
        return configured
    return shutil.which("codex")


def _login_status(codex_binary: str, timeout: float) -> dict[str, str | None]:
    try:
        result = subprocess.run(
            [codex_binary, "login", "status"],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return {"state": "error", "method": None}
    return parse_login_result(result.returncode, result.stdout or "", result.stderr or "")


def collect_status(timeout: float = 12.0) -> dict[str, Any]:
    """Collect a safe status snapshot for both UI adapters."""
    codex_binary = _find_codex_binary()
    if codex_binary is None:
        auth: dict[str, str | None] = {"state": "error", "method": None}
        usage: dict[str, Any] = {
            "state": "unavailable",
            "reason": "Codex CLI was not found",
            "plan": None,
            "primary": None,
            "secondary": None,
        }
    else:
        auth = _login_status(codex_binary, min(timeout, 5.0))
        if auth["state"] != "signed_in":
            reason = "Sign in to Codex CLI to check usage" if auth["state"] == "signed_out" else "Could not check Codex CLI sign-in"
            usage = {
                "state": "unavailable",
                "reason": reason,
                "plan": None,
                "primary": None,
                "secondary": None,
            }
        elif auth["method"] != "chatgpt":
            usage = {
                "state": "unavailable",
                "reason": "Usage limits require ChatGPT sign-in",
                "plan": None,
                "primary": None,
                "secondary": None,
            }
        else:
            try:
                usage = normalize_usage_response(read_rate_limits(codex_binary, timeout))
                if usage["state"] == "unavailable":
                    usage["reason"] = "Codex usage limits were not returned"
            except AppServerError:
                usage = {
                    "state": "error",
                    "reason": "Could not load Codex usage. Try refreshing.",
                    "plan": None,
                    "primary": None,
                    "secondary": None,
                }

    return {
        "schemaVersion": 1,
        "checkedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "auth": auth,
        "usage": usage,
    }
