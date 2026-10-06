import React from 'react';
import { Action, ActionPanel, Icon, List } from '@vicinae/api';
import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { formatAuth, formatCheckedAt, formatQuotaWindow, type QuotaWindow } from './format.js';

type Status = {
  auth: { state: string; method?: string };
  usage: {
    state: string;
    reason?: string;
    primary?: QuotaWindow;
    secondary?: QuotaWindow;
  };
  checkedAt: string;
};

type ListItemArgs = {
  title: string;
  subtitle?: string;
  icon?: any;
  accessory?: string;
  refresh: () => void;
  key?: string;
};

function providerPath(): string {
  return process.env.CODEXSTATUS_PROVIDER
    || path.join(os.homedir(), '.local', 'bin', 'codexstatus');
}

function readStatus(): Promise<Status> {
  return new Promise((resolve, reject) => {
    execFile(
      providerPath(),
      [],
      { encoding: 'utf8', timeout: 25000, maxBuffer: 64 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(new Error('Could not run the Codex Status provider'));
          return;
        }
        try {
          resolve(JSON.parse(stdout) as Status);
        } catch {
          reject(new Error('Codex Status returned unreadable data'));
        }
      },
    );
  });
}

function refreshPanel(refresh: () => void): React.ReactElement {
  return React.createElement(
    ActionPanel,
    null,
    React.createElement(Action, {
      title: 'Refresh status',
      icon: Icon.ArrowClockwise,
      onAction: refresh,
    }),
  );
}

function listItem({ title, subtitle, icon, accessory, refresh, key }: ListItemArgs): React.ReactElement {
  return React.createElement(List.Item, {
    key,
    title,
    subtitle,
    icon,
    accessories: accessory ? [{ text: accessory }] : [],
    actions: refreshPanel(refresh),
  });
}

function quotaItems(usage: Status['usage'], refresh: () => void): React.ReactElement[] {
  const rows: React.ReactElement[] = [];
  [usage.primary, usage.secondary].forEach((window, index) => {
    const formatted = formatQuotaWindow(window, index);
    if (!formatted) return;
    rows.push(listItem({
      key: formatted.title,
      title: formatted.title,
      subtitle: formatted.subtitle,
      icon: Icon.Clock,
      accessory: formatted.accessory,
      refresh,
    }));
  });
  return rows.length
    ? rows
    : [listItem({ title: 'No usage windows returned', icon: Icon.Warning, refresh })];
}

function CodexStatus(): React.ReactElement {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [refreshToken, setRefreshToken] = React.useState(0);
  const refresh = React.useCallback(() => setRefreshToken((token) => token + 1), []);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    readStatus()
      .then((value) => {
        if (!active) return;
        setStatus(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setStatus(null);
        setError(reason instanceof Error ? reason.message : 'Could not load Codex status');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshToken]);

  const sections: React.ReactElement[] = [];
  if (status) {
    sections.push(
      React.createElement(
        List.Section,
        { key: 'account', title: 'Codex CLI' },
        listItem({
          title: formatAuth(status.auth),
          subtitle: status.auth.state === 'signed_in' ? 'Sign-in status' : 'Authentication status',
          icon: status.auth.state === 'signed_in' ? Icon.Checkmark : Icon.Warning,
          refresh,
        }),
      ),
    );

    const usageRows = status.usage.state === 'available'
      ? quotaItems(status.usage, refresh)
      : [listItem({
          title: status.usage.state === 'error' ? 'Usage check failed' : 'Usage unavailable',
          subtitle: status.usage.reason || 'Usage limits were not returned',
          icon: Icon.Warning,
          refresh,
        })];
    sections.push(
      React.createElement(List.Section, { key: 'usage', title: 'Usage' }, usageRows),
    );
    sections.push(
      React.createElement(
        List.Section,
        { key: 'updated', title: 'Updated' },
        listItem({
          title: formatCheckedAt(status.checkedAt),
          icon: Icon.Clock,
          refresh,
        }),
      ),
    );
  } else if (error) {
    sections.push(
      React.createElement(
        List.Section,
        { key: 'error', title: 'Codex CLI' },
        listItem({ title: 'Could not load status', subtitle: error, icon: Icon.Warning, refresh }),
      ),
    );
  }

  sections.push(
    React.createElement(
      List.Section,
      { key: 'actions', title: 'Actions' },
      listItem({ title: 'Refresh status', icon: Icon.ArrowClockwise, refresh }),
    ),
  );

  return React.createElement(
    List,
    { navigationTitle: 'Codex Status', searchBarPlaceholder: 'Codex sign-in and usage', isLoading },
    sections,
  );
}

export default CodexStatus;
