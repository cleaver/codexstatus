import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import { formatMenuLines, formatPanelLabel } from './format.mjs';

const REFRESH_INTERVAL_SECONDS = 120;

function providerPath() {
  return GLib.getenv('CODEXSTATUS_PROVIDER')
    || GLib.build_filenamev([GLib.get_home_dir(), '.local', 'bin', 'codexstatus']);
}

function unavailableSnapshot() {
  return {
    auth: { state: 'error', method: null },
    usage: { state: 'error', reason: 'Could not run the Codex Status provider' },
    checkedAt: new Date().toISOString(),
  };
}

export default class CodexStatusExtension extends Extension {
  enable() {
    this._enabled = true;
    this._status = null;
    this._refreshing = false;

    this._button = new PanelMenu.Button(0.0, 'Codex Status', false);
    this._label = new St.Label({
      text: 'Codex …',
      y_align: Clutter.ActorAlign.CENTER,
      style_class: 'codex-status-panel-label',
    });
    this._button.add_child(this._label);

    this._menuDetails = new PopupMenu.PopupMenuSection();
    this._button.menu.addMenuItem(this._menuDetails);
    this._button.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    const refreshItem = new PopupMenu.PopupMenuItem('Refresh status');
    refreshItem.connect('activate', () => this._refresh());
    this._button.menu.addMenuItem(refreshItem);

    Main.panel.addToStatusArea('codex-status', this._button);
    this._refresh();
    this._refreshTimeout = GLib.timeout_add_seconds(
      GLib.PRIORITY_DEFAULT,
      REFRESH_INTERVAL_SECONDS,
      () => {
        this._refresh();
        return GLib.SOURCE_CONTINUE;
      },
    );
  }

  disable() {
    this._enabled = false;
    if (this._refreshTimeout) {
      GLib.Source.remove(this._refreshTimeout);
      this._refreshTimeout = 0;
    }
    this._button?.destroy();
    this._button = null;
    this._label = null;
    this._menuDetails = null;
    this._status = null;
  }

  _refresh() {
    if (!this._enabled || this._refreshing) return;
    this._refreshing = true;
    let process;
    try {
      process = Gio.Subprocess.new(
        [providerPath()],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE,
      );
    } catch {
      this._setStatus(unavailableSnapshot());
      this._refreshing = false;
      return;
    }

    process.communicate_utf8_async(null, null, (child, result) => {
      this._refreshing = false;
      if (!this._enabled) return;
      try {
        const [ok, stdout] = child.communicate_utf8_finish(result);
        if (!ok) throw new Error('Provider process failed');
        this._setStatus(JSON.parse(stdout));
      } catch {
        this._setStatus(unavailableSnapshot());
      }
    });
  }

  _setStatus(status) {
    this._status = status;
    this._label.text = formatPanelLabel(status);
    this._menuDetails.removeAll();
    for (const line of formatMenuLines(status)) {
      this._menuDetails.addMenuItem(
        new PopupMenu.PopupMenuItem(line, { reactive: false, can_focus: false }),
      );
    }
  }
}
