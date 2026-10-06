#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
data_home=${XDG_DATA_HOME:-"$HOME/.local/share"}
bin_dir="$HOME/.local/bin"
vicinae_dir="$data_home/vicinae/extensions/codex-status"

if [ ! -f "$project_dir/vicinae-extension/node_modules/@vicinae/api/dist/bin.js" ]; then
  npm install --prefix "$project_dir/vicinae-extension" --no-audit --no-fund
fi

node "$project_dir/scripts/build.mjs" "$vicinae_dir"

install -d "$bin_dir" "$data_home/codexstatus/src/codexstatus"
install -m 755 "$project_dir/bin/codexstatus" "$bin_dir/codexstatus"
for source_file in "$project_dir"/src/codexstatus/*.py; do
  install -m 644 "$source_file" "$data_home/codexstatus/src/codexstatus/"
done

gnome-extensions install --force "$project_dir/dist/codex-status@local.zip"

printf '%s\n' \
  "Installed provider at $bin_dir/codexstatus" \
  "Installed GNOME and Vicinae extensions." \
  "Log out and back in so GNOME Shell discovers the new extension." \
  "Then enable GNOME with: gnome-extensions enable codex-status@local" \
  "Search for Codex Status in Vicinae."
