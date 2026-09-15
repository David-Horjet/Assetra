"use client";

import type { HealthState } from "@/lib/types";

/**
 * Position health as a word and a colour, never a bare ratio.
 *
 * "Healthy" tells the user what to do with the information; "0.53" does not.
 * The exact numbers stay available one disclosure deeper.
 */
const LABELS: Record<HealthState, string> = {
  healthy: "Healthy",
  moderate: "Moderate",
  "at-risk": "At risk",
  critical: "Critical",
};

const COLORS: Record<HealthState, string> = {
  healthy: "var(--color-signal-mint)",
  moderate: "#e2c53f",
  "at-risk": "#e2913f",
  critical: "#e25c5c",
};

export function HealthPill({
  state,
  showDot = true,
}: {
  state: HealthState;
  showDot?: boolean;
}) {
  const color = COLORS[state];

  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill px-2.5 py-1"
      style={{
        color,
        // A tint of the state colour rather than a solid fill: readable
        // against the dark ground without shouting.
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        fontSize: "var(--text-caption)",
      }}
    >
      {showDot && (
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
      )}
      {LABELS[state]}
    </span>
  );
}

export { COLORS as HEALTH_COLORS, LABELS as HEALTH_LABELS };
