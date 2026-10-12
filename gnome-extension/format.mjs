function formatSignIn(auth = {}) {
  if (auth.state === 'signed_out') return 'Not signed in to Codex CLI';
  if (auth.state !== 'signed_in') return 'Could not check Codex CLI sign-in';

  const methods = {
    chatgpt: 'ChatGPT',
    api_key: 'API key',
    workload_identity: 'workload identity',
    access_token: 'access token',
    personal_access_token: 'personal access token',
    bedrock_api_key: 'Amazon Bedrock API key',
    bedrock_access_keys: 'Amazon Bedrock credentials',
  };
  return `Signed in with ${methods[auth.method] ?? 'Codex credentials'}`;
}

function formatTime(value, timeZone, includeDate = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown time';
  const options = {
    ...(includeDate ? { month: 'short', day: 'numeric' } : {}),
    hour: 'numeric',
    minute: '2-digit',
  };
  if (timeZone) options.timeZone = timeZone;
  try {
    return new Intl.DateTimeFormat(undefined, options).format(date);
  } catch {
    return 'unknown time';
  }
}

function quotaName(window, position) {
  if (window?.windowDurationMins === 300) return '5-hour limit';
  if (window?.windowDurationMins === 10080) return 'Weekly limit';
  if (window?.windowDurationMins === 1440) return 'Daily limit';
  if (window?.windowDurationMins === 60) return 'Hourly limit';
  return position === 0 ? 'Primary limit' : 'Secondary limit';
}

function formatQuota(window, position, timeZone) {
  if (!window || typeof window.remainingPercent !== 'number') return null;
  const remaining = Math.max(0, Math.min(100, Math.round(window.remainingPercent)));
  const includeDate = window.windowDurationMins >= 1440;
  const reset = window.resetsAt
    ? ` · resets at ${formatTime(window.resetsAt, timeZone, includeDate)}`
    : '';
  return `${quotaName(window, position)}: ${remaining}% left${reset}`;
}

export function formatPanelLabel(status) {
  const auth = status?.auth ?? {};
  const usage = status?.usage ?? {};
  if (auth.state === 'signed_out') return 'Codex off';
  if (auth.state !== 'signed_in') return 'Codex ?';
  if (usage.state === 'error') return 'Codex !';

  const primary = usage.primary ?? usage.secondary;
  if (usage.state === 'available' && typeof primary?.remainingPercent === 'number') {
    const remaining = Math.max(0, Math.min(100, Math.round(primary.remainingPercent)));
    return `Codex ${remaining}%`;
  }
  return 'Codex ✓';
}

export function formatMenuLines(status, options = {}) {
  const lines = [formatSignIn(status?.auth)];
  const usage = status?.usage ?? {};
  if (usage.state === 'available') {
    if (usage.plan) lines.push(`Plan: ${usage.plan}`);
    const quotas = [usage.primary, usage.secondary]
      .map((window, position) => formatQuota(window, position, options.timeZone))
      .filter(Boolean);
    lines.push(...(quotas.length ? quotas : ['No usage windows returned']));
  } else {
    lines.push(usage.reason || 'Usage limits are unavailable');
  }

  if (status?.checkedAt) lines.push(`Checked at ${formatTime(status.checkedAt, options.timeZone)}`);
  return lines;
}
