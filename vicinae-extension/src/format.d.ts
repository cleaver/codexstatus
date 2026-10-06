export type TimeFormatOptions = {
  timeZone?: string;
  locale?: string;
};

export type QuotaWindow = {
  remainingPercent: number;
  windowDurationMins?: number;
  resetsAt?: string;
};

export function formatAuth(auth?: { state?: string; method?: string }): string;
export function formatCheckedAt(value: string, options?: TimeFormatOptions): string;
export function formatQuotaWindow(
  window: QuotaWindow | null | undefined,
  position: number,
  options?: TimeFormatOptions,
): { title: string; accessory: string; subtitle: string } | null;
