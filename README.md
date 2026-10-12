# Codex Status

Codex Status provides one local status source for a GNOME top bar indicator and a Vicinae launcher view. It checks the Codex CLI's own login status and, for ChatGPT sign-ins, asks Codex app-server for the current quota windows. Both front ends show when the snapshot was checked.

The login check uses `codex login status`; it does not read or display credential files. Login status and quota availability are separate: a signed-in CLI can still have usage data unavailable, and API key sign-ins do not currently provide quota windows through this app-server request.

## Requirements

- Linux with Python 3.10 or newer and the Codex CLI on `PATH`
- GNOME Shell 50 for the top bar extension
- Vicinae 0.23.2 for the launcher extension
- Node.js for building the Vicinae command and packages

## Build and check

From the project directory:

```sh
npm install --prefix vicinae-extension
make test
make build
```

`make test` runs provider unit/integration tests, both UI formatter suites, and a load check for the built Vicinae command. `make build` uses Vicinae's `vici` builder to validate and bundle the command, then creates installable GNOME and Vicinae archives in `dist/`.

Open [docs/preview.html](docs/preview.html) for a browser mockup, or [docs/preview.svg](docs/preview.svg) for a static image of both surfaces using sample data.

The GNOME extension archive places `metadata.json` and its entrypoint at the ZIP root. The sandbox's `gnome-extensions pack` command segfaulted, so `make build` creates and integrity-checks the same source-tree package layout directly.

## Install

Run:

```sh
./install.sh
```

The installer puts the provider at `~/.local/bin/codexstatus`, its Python package under `${XDG_DATA_HOME:-~/.local/share}/codexstatus/src`, installs the GNOME extension archive, and runs `vici build` directly into `${XDG_DATA_HOME:-~/.local/share}/vicinae/extensions/codex-status`.

On GNOME Wayland, log out and back in so the running Shell discovers the newly installed extension. GNOME Shell enumerates extension directories when its extension manager initializes; the CLI's `enable` command asks that running Shell to look up the UUID. Then enable it:

```sh
gnome-extensions enable codex-status@local
```

After installation, search for **Codex Status** in Vicinae. Its standard builder writes the compiled command to the extension directory, where Vicinae can discover it without restarting.

The GNOME indicator checks status on enable and every two minutes; its menu and the Vicinae view also provide a manual refresh.

If the provider or Codex CLI is installed at a custom path, set `CODEXSTATUS_PROVIDER` and/or `CODEX_BIN` in the desktop session environment before starting GNOME Shell or Vicinae.

## Status behavior

- **Signed in / signed out / check unavailable** comes from `codex login status`.
- **Usage available / unavailable / error** comes from the separate app-server quota read. Missing windows remain absent rather than being shown as full quota.
- Reset times are displayed in the local time zone. Windows of at least one day include the reset date; shorter windows show only the time. Percentages show remaining quota.
- The provider emits a checked-at UTC timestamp and normalized JSON. It does not include raw CLI output, API key fragments, or app-server diagnostics.

Run the provider directly for its JSON snapshot:

```sh
~/.local/bin/codexstatus --pretty
```

## Limitations

Quota reads use Codex app-server's current account rate-limit protocol, which may change with Codex CLI releases. This first version is a one-shot local provider rather than a background daemon, so each refresh starts the CLI. The panel uses a fixed two-minute refresh interval. Session activity, notifications, and quota history are out of scope.

The development sandbox used to build this project does not allow access to the user's GNOME Shell or Vicinae session sockets, and its app-server process cannot write its normal local state. Provider integration tests use a fake Codex executable, so the real authenticated quota response and in-session rendering must be confirmed on the desktop after installation.
