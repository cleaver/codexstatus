# Task Plan: Codex Status for GNOME and Vicinae

## Goal
Build a local Codex status utility with a GNOME top-bar extension and a Vicinae extension sharing one status source, with tests and a verified definition of done.

## Current Phase
Phase 5: Documentation and delivery (follow-up fixes complete)

## Definition of done
- A shared local status provider reports authentication state, available quota windows and reset times when available, freshness, and distinct unavailable/error states without exposing credentials.
- A GNOME Shell 50 extension displays a compact top-bar indicator and a useful click menu.
- A Vicinae extension displays the same status in a richer view and offers refresh.
- Tests cover parsing/normalizing login and quota results, missing quota windows, and command failures; integration tests exercise the public provider interface with fixtures.
- Project has documented setup, run, test, and known limitations.
- Verification includes automated tests, both extension build/package checks, and a visual or runtime preview where the installed environment permits.

## Phases
### Phase 1: Requirements & discovery
- [x] Confirm intent and inspect workspace/system
- [x] Define initial scope and completion criteria
- [x] Record integration API requirements
- **Status:** complete

### Phase 2: Architecture and scaffolding
- [x] Select shared provider and data contract
- [x] Set up tests and GNOME extension structure
- [x] Set up Vicinae extension structure
- **Status:** complete

### Phase 3: Vertical implementation
- [x] Implement tested status provider
- [x] Implement GNOME panel adapter
- [x] Implement Vicinae adapter
- **Status:** complete

### Phase 4: Testing and visual/runtime verification
- [x] Run provider tests and package/build checks
- [x] Preview both interfaces and correct issues
- [x] Check installer in an isolated temporary home using a fake GNOME installer
- **Status:** complete with live-session limitation

### Phase 5: Documentation and delivery
- [x] Document installation, use, and limitations
- [x] Audit requirements against current artifacts
- [x] Stabilize Vicinae time formatting tests across system locales
- [x] Document the GNOME Shell rescan step after installing an extension
- **Status:** complete

## Decisions made
| Decision | Rationale |
|---|---|
| Build both GNOME panel and Vicinae front ends over one provider | User explicitly prefers both; shared semantics prevent UI drift. |
| Start with auth and usage/freshness states, plus manual refresh | Matches the discussed MVP; session activity and alerts are optional later scope. |
| Do not read or expose auth token files | `codex login status` is the CLI-owned check; protect credentials and avoid coupling to auth file internals. |
| Write the provider in Python and expose JSON over a CLI | Python is already installed; both GJS and Node can launch it without new runtime services. |
| Read quota through Codex app-server stdio RPC, sending no capability flags | Uses Codex's structured account response; do not opt into unrelated reserve behavior. |
| Use installed Vicinae 0.23.2 API and `vici` project conventions | The system's existing Audio Switcher extension provides a version-matched manifest and scripts. |

## Errors encountered
| Error | Attempt | Resolution |
|---|---:|---|
| Workspace has no application files or valid Git repository | 1 | Treat as a new project; create local project structure. |
| App-server protocol probe exited before `initialize`, causing broken pipe | 1 | Diagnosed with a second launch probe; state writes remain denied even with SQLite redirected to `/tmp`, so continue with fixture-based protocol/provider tests and report the live quota limitation. |
| GitHub cache could not fetch one extension example directory | 1 | Use the installed local extension as a version-specific source template instead. |
| NPM offline pack could not write to the read-only user cache | 1 | Avoid mutating `~/.npm`; use the cached installed extension manifest and a local build path. |
| Initial patch for additional provider tests did not match the file | 1 | Read the test files and apply the additions at their actual class locations. |
| `gnome-extensions pack` segfaulted in the sandbox | 2 | Build a ZIP with GNOME's expected root layout and validate the archive contents. |
| Vicinae command package initially used a hand-copied JavaScript entrypoint | 1 | Move the view to `src/codex-status.tsx` and use Vicinae's `vici build` so it validates and bundles the command and local formatter. |
| Vicinae quota formatter test expected US meridiem under an en-CA system locale | 1 | Reproduced the locale-sensitive output; pin the test to `en-US` while production formatting continues to use the system locale. |
| GNOME enable command could not find the just-installed extension | 1 | Confirm the installed directory and UUID match, then document logging out and back in on Wayland so the running Shell indexes the extension. |
| Vicinae command was not visible after install | 1 | The custom copier bypassed Vicinae's supported `vici build` pipeline and the required `src/<command>.tsx` entrypoint. Switch to the official compiler for bundling and direct installation; no server restart should be needed. |

## Key questions
1. Can extension outputs be launched/previewed in this environment without writing outside the workspace?
- Answer: live activation and the live command registry are blocked by session socket access. Vicinae's `vici build` and manifest lint both pass; the generated package and compiled entrypoint load check pass, and a static preview was rendered and inspected.
