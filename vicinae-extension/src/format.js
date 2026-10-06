'use strict';

const AUTH_LABELS = {
  chatgpt: 'ChatGPT',
  api_key: 'API key',
  workload_identity: 'workload identity',
  access_token: 'access token',
  personal_access_token: 'personal access token',
  bedrock_api_key: 'Amazon Bedrock API key',
  bedrock_access_keys: 'Amazon Bedrock credentials',
};

function formatAuth(auth = {}) {
  if (auth.state === 'signed_out') return 'Not signed in to Codex CLI';
  if (auth.state !== 'signed_in') return 'Could not check Codex CLI sign-in';
  return `Signed in with ${AUTH_LABELS[auth.method] || 'Codex credentials'}`;
}

function formatTime(value, options = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const dateOptions = { hour: 'numeric', minute: '2-digit' };
  if (options.timeZone) dateOptions.timeZone = options.timeZone;
  try {
    return new Intl.DateTimeFormat(options.locale, dateOptions).format(date);
  } catch {
    return null;
  }
}

function formatQuotaWindow(window, position, options = {}) {
  if (!window || typeof window.remainingPercent !== 'number') return null;
  const labels = {
    300: '5-hour limit',
    10080: 'Weekly limit',
    1440: 'Daily limit',
    60: 'Hourly limit',
  };
  const title = labels[window.windowDurationMins]
    || (position === 0 ? 'Primary limit' : 'Secondary limit');
  const remaining = Math.max(0, Math.min(100, Math.round(window.remainingPercent)));
  const reset = window.resetsAt ? formatTime(window.resetsAt, options) : null;
  return {
    title,
    accessory: `${remaining}% left`,
    subtitle: reset ? `Resets at ${reset}` : 'Reset time unavailable',
  };
}

function formatCheckedAt(value, options = {}) {
  const time = formatTime(value, options);
  return time ? `Checked at ${time}` : 'Update time unavailable';
}

module.exports = { formatAuth, formatCheckedAt, formatQuotaWindow };
