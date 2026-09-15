/** Display formatting. Kept pure and framework-free so it is easy to verify. */

/**
 * Format a USD value.
 *
 * Large sums drop the cents — at portfolio scale the decimals are noise, and
 * the design calls for clear numbers over dense ones.
 */
export function usd(value: number, opts?: { compact?: boolean }): string {
  if (!Number.isFinite(value)) return "—";

  if (opts?.compact && Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("en-US", {
      maximumFractionDigits: 1,
    })}M`;
  }

  const showCents = Math.abs(value) < 10_000;
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  });
}

/** Format a token quantity, trimming trailing zeros. */
export function tokenAmount(value: number, maxDecimals = 4): string {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  // Sub-threshold amounts would render as "0" and read as an empty balance.
  if (Math.abs(value) < 10 ** -maxDecimals) return `<${10 ** -maxDecimals}`;
  return value.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}

/** Format a fraction as a percentage (0.0458 → "4.58%"). */
export function percent(fraction: number, decimals = 2): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Format a signed percentage change, always carrying its sign. */
export function signedPercent(value: number | null, decimals = 2): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/** Relative time, e.g. "2 hours ago". Used for oracle freshness. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";

  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Shorten a Solana address for display. */
export function shortAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
