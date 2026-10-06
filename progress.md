# Progress Log

## Session: 2026-10-05

### Phase 1: Requirements and discovery
- **Status:** complete
- Confirmed active goal; inspected workspace and installed CLI/runtime versions.
- Workspace is empty, so the project will be created here.
- Environment is GNOME Shell 50.4 on Wayland, with Vicinae, Node/npm, and Codex CLI 0.160.0 installed.
- Recorded the user's requested combined panel + Vicinae solution and an initial definition of done in `task_plan.md`.
- Files created: `task_plan.md`, `findings.md`, `progress.md`.

### Phase 2: Architecture and scaffolding
- **Status:** complete
- Chose a Python provider invoked by both UIs; no always-running daemon for the MVP.
- Provider contract includes schema version, checked time, normalized auth method/state, quota state/reason, and primary/secondary limit windows.
- Created GNOME extension formatter tests and began the GNOME adapter.
- Read-only app-server environment cannot provide a real quota snapshot; fixture tests verify JSON-RPC behavior instead.

### Phase 3: Vertical implementation
- **Status:** complete
- Implemented the shared Python JSON provider, GNOME Shell 50 panel menu, and Vicinae view with manual refresh.
- The provider normalizes login state, quota windows, reset times, freshness, and explicit unavailable/error states. Raw CLI output and app-server diagnostics are not forwarded to either UI.

### Phase 4: Testing and preview
- **Status:** complete with runtime limitations
- `make test`: 12 Python provider tests, 4 GNOME formatter tests, 3 Vicinae formatter tests, and 1 built-entrypoint load test passed.
- `make build`: Vicinae source syntax check, package checks, and both extension archives passed.
- `unzip -t` passed for both archives; expected entrypoint, metadata, and icon files were present.
- Rendered and visually inspected `docs/preview.png` from the sample-data SVG preview; the Vicinae icon was also inspected.
- Isolated installer check copied the provider and both extension trees into a temporary home and exercised the installed provider against a fake Codex executable.
- Live extension activation was unavailable: the sandbox denies GNOME/Vicinae session access, `vici` is not installed, and `gnome-extensions pack` segfaults here. The project uses validated source-tree packaging; the README records this limitation.

### Phase 5: Documentation and delivery
- **Status:** complete
- Added setup, build, install, status behavior, and protocol limitations to `README.md`.
- Build artifacts: `dist/codex-status@local.zip` and `dist/codex-status-vicinae.zip`; static previews are under `docs/`.

### Follow-up diagnostics
- Reproduced the Vicinae formatter failure with `LANG=en_CA.UTF-8 LC_ALL=en_CA.UTF-8`; the host locale rendered `5:30 p.m.` while the assertion expected `5:30 PM`.
- Added optional locale forwarding to the Vicinae time formatter and pinned the formatting test to `en-US`. Runtime views still use the user's system locale by default.
- Confirmed the GNOME extension is installed under `~/.local/share/gnome-shell/extensions/codex-status@local` and its metadata UUID matches that directory. The running Shell could not be queried from this sandbox, so the installer and README now direct Wayland users to log out and back in before enabling it.
- `LANG=en_CA.UTF-8 LC_ALL=en_CA.UTF-8 make test` passed: 12 Python tests, 4 GNOME formatter tests, 3 Vicinae formatter tests, and 1 packaged-entrypoint load test. Build checks passed as part of `make test`.
- Final packaging checks: `sh -n install.sh`, Node syntax checks for the Vicinae formatter and test, and `unzip -t` for both archives passed.
- Follow-up for Vicinae discovery: confirmed the copied extension was at `~/.local/share/vicinae/extensions/codex-status`, but the project had bypassed Vicinae's compiler and used `src/codex-status.js` instead of the required `src/codex-status.tsx`. The official `vici build` bundles TSX commands and writes the production package to the extension directory. Reworked the source and installer to use that pipeline, and removed the unsupported restart advice. The live command list remains inaccessible through the sandbox socket.
- Verified the revised path with the installed Vicinae 0.23.2 CLI: `node scripts/build.mjs` completed `vici build`, type checking, manifest lint, and both archives. The archive contains `package.json`, `codex-status.js`, and `assets/icon.png`; both the formatter and compiled-entrypoint checks pass. Installing the revised build should make the command searchable without restarting Vicinae; in-session discovery cannot be queried from this sandbox.

## Test results
| Test | Input | Expected | Actual | Status |
|---|---|---|---|---|
| Local login status check | `codex login status` | Report current CLI auth mode | `Logged in using ChatGPT` | ✓ |
| Provider unit/integration suite | `PYTHONPATH=src python3 -m unittest discover -s tests -v` | All provider cases pass | 12 tests passed | ✓ |
| Provider runtime snapshot | `bin/codexstatus --pretty` | Auth + usage state in JSON | Auth signed in; usage error due app-server read-only failure | ✓ (degraded environment state) |
| GNOME formatter suite | `node tests/ui_format.test.mjs` | Compact and detailed labels render | 4 tests passed | ✓ |
| Vicinae formatter suite | `node tests/vicinae_format.test.mjs` | Auth and quota rows render | 3 tests passed | ✓ |
| Combined verification | `make test && make build` | Provider, UI, and packages validate | 12 + 4 + 3 + 1 tests; both packages built | ✓ |
| Isolated install | `install.sh` under temporary `HOME`/`XDG_DATA_HOME` | Copy both extensions and run installed provider | Passed against fake GNOME installer and Codex executable | ✓ |

## Error log
| Timestamp | Error | Attempt | Resolution |
|---|---|---:|---|
| 2026-10-05 | No app files; `.git` is not a repository | 1 | Initialize fresh project; no user changes to preserve. |
| 2026-10-05 | App-server cannot initialize under read-only sandbox state | 2 | Provider catches the failure; test RPC parsing and error states with fixtures. |
| 2026-10-05 | NPM offline pack attempted to write under read-only `~/.npm` | 1 | Do not retry there; use workspace and `/tmp` for package work. |
| 2026-10-05 | First patch for additional tests did not match current file | 1 | Read both test files and apply the change against current context. |
- Additional discovery: reviewed current Vicinae extension docs; its native React/TypeScript extension API matches the richer detail view requirement. Added source to `findings.md`.
- Verified local tools: Codex CLI 0.160.0 (currently logged in via ChatGPT), Vicinae 0.23.2, GNOME Shell 50.4, Node/npm, and Python 3 are installed. `codex app-server --help` supports stdio but calls the interface experimental.
- Researching the app-server initialization and local Vicinae build workflow before selecting the provider boundary.
- Generated protocol JSON Schema from the installed Codex CLI in `/tmp/codexstatus-protocol`; confirmed exact quota response fields and documented the safe request shape.
- Runtime limitation found: the sandbox cannot access Vicinae's socket or the GNOME extension D-Bus interface. Package validation remains possible; user-session installation may be unavailable.
- Confirmed Vicinae's own extensions repo publishes a package schema and `vici lint` validation command. Added this as a package-validation gate.
- App-server RPC probe attempt 1 exited before the initialize response and broke the pipe. Logging this failure; next try uses writable SQLite state under `/tmp` to determine whether sandbox home writes caused it.
- Read the installed local Vicinae extension manifest (`audio-switcher`) to determine exact version-compatible package scripts, dependency version, and extension install directory. The cached `@vicinae/api` tarball should allow offline build.
- Second app-server probe using `CODEX_SQLITE_HOME=/tmp` still exited before initialize with a read-only filesystem error; record as a live quota verification limitation, not a reason to drop quota support.
