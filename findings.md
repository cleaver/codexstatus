# Findings & Decisions

## Requirements
- User wants a Codex status product with both a GNOME top-bar module and a Vicinae extension.
- The top bar should show a compact status whenever the panel is visible; Vicinae should provide a richer UI.
- Build, write and run tests, inspect the output as much as possible, and continue to a complete deliverable.
- Agreed MVP candidates: login state, quota windows/reset times, freshness/unavailable/error states, refresh. Session activity and notifications may be deferred unless cheap and clearly useful.

## Environment findings (2026-10-05)
- Workspace `/home/cleaver/Documents/projects/build/codexstatus` is empty; `.git` is an empty directory, not a Git repository.
- Current shell reports GNOME on Wayland; GNOME Shell is 50.4 and `gnome-extensions` is installed.
- `vicinae` is installed at `/usr/local/bin/vicinae`; Node and npm are available.
- Codex CLI is `codex-cli 0.160.0`; `codex login status` currently returns `Logged in using ChatGPT`.
- Sandbox writes are authorized only within this workspace and `/tmp`.

## Research findings
- Current Codex CLI implements `codex login status`; it reports auth mode and exits success when configured auth is recognized, and reports `Not logged in` with a failure exit code when no stored auth exists. It does not prove every request will succeed. Source: https://github.com/openai/codex/blob/main/codex-rs/cli/src/login.rs
- Current Codex App Server protocol contains structured account rate-limit reads and update notifications. Its account processor requires ChatGPT authentication for account quota reads. Sources: https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/account.rs and https://github.com/openai/codex/blob/main/codex-rs/app-server/src/request_processors/account_processor.rs
- Vicinae script commands suit one-shot lookups; React/TypeScript extensions support richer launcher views. Docs: https://docs.vicinae.com/scripts/getting-started and https://docs.vicinae.com/install-extensions
- Treat app-server quota RPC as a current protocol that can evolve; avoid direct calls to undocumented backend endpoints or parsing `auth.json`.

## Technical decisions
| Decision | Rationale |
|---|---|
| Use a small shared local provider invoked on demand by each UI initially | Avoid a daemon lifecycle and avoid polling when both surfaces are closed; GNOME panel can refresh on its own cadence. |
| The provider owns normalization and tests | Both UIs consume one stable JSON contract. |
| Separate auth state from quota/network state | A configured login can still have quota unavailable or backend requests fail. |
| Keep session activity and notifications out of first release | They require separate state tracking and policy decisions; not needed for agreed MVP. |

## Resources
- Codex login status source: https://github.com/openai/codex/blob/main/codex-rs/cli/src/login.rs
- Codex account rate-limit protocol: https://github.com/openai/codex/blob/main/codex-rs/app-server-protocol/src/protocol/v2/account.rs
- Vicinae extension/script docs: https://docs.vicinae.com/install-extensions, https://docs.vicinae.com/scripts/getting-started
- Vicinae's extension documentation confirms extensions are TypeScript + React rendered natively (no browser); `npm install && npm run build` makes commands discoverable from the extension source tree. Source: https://docs.vicinae.com/extensions/introduction and https://docs.vicinae.com/install-extensions
- Vicinae extension APIs provide UI actions and detail views, suitable for usage windows and a manual refresh action.
- This installed environment is Codex CLI 0.160.0 and Vicinae 0.23.2. `codex app-server --help` supports stdio transport by default and identifies app-server as experimental; prefer its typed request surface while keeping an explicit unavailable/error fallback.
- Codex app-server uses a newline-delimited request sequence: `initialize` with `clientInfo`, then `initialized`, then RPC requests. The current source and protocol types include `account/rateLimits/read`; changes arrive as sparse notifications, so a one-shot snapshot request is simpler for the MVP.
- `codex login status` emits its status to stderr in current source; the provider must capture both stdout and stderr, normalize known states, and avoid rendering the raw output (API-key mode can include a masked key fragment).
- Vicinae 0.23.2 supports local source-tree extensions rebuilt by `npm run build`; local CLI help exposes script templates/check but no extension-dev subcommand. Need verify local source discovery workflow from docs/active app.
- The installed Codex CLI can generate its own current protocol JSON Schemas. Schema confirms `account/rateLimits/read` accepts nullable params and returns `rateLimits`, optional `rateLimitsByLimitId`, `primary`/`secondary` windows with `usedPercent`, and reset epoch seconds. Prefer the `codex` bucket when keyed results exist; convert used% to remaining% in the shared provider.
- For a status-only read, do not advertise the optional `supportsLunaReserve` capability; it is an explicit usage capability with potential backend experiment side effects. Omit the optional param or pass an empty object.
- Current session cannot access `vicinae`'s running user socket (`Operation not permitted`) or list enabled GNOME extensions (exit 2); runtime installation/activation cannot be assumed. Build/package checks and a local visual preview are still available.
- The Vicinae extensions repository specifies a package schema and provides `npx vici lint` validation (with `@vicinae/api` 0.16+). This is a useful completion gate beyond TypeScript compilation. Source: https://github.com/vicinaehq/extensions
- Local Vicinae installs extensions at `~/.local/share/vicinae/extensions/<name>`. The installed `audio-switcher` package provides a working version-specific template: package scripts `vici build`, `vici develop`, `vici lint`, and tests via `tsx --test`; runtime dependency `@vicinae/api: 0.23.2`.
- The `@vicinae/api` 0.23.2 tarball is already in the npm cache, so dependency installation may be possible offline. The installed extension source is read-only/outside the workspace and will only be used as a reference.
- App-server still exits before initialization when SQLite state is redirected to `/tmp`; its final diagnostic is a read-only filesystem error. This sandbox limitation is logged; fixture-driven provider behavior remains testable.
