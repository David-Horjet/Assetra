"use client";

import { motion, useReducedMotion } from "motion/react";
import { usd } from "@/lib/format";

interface CapitalBarProps {
  workingUsd: number;
  idleUsd: number;
}

/**
 * The Working vs Idle split — the product's central idea in one element.
 *
 * Deliberately a single bar rather than a chart: the question it answers is
 * "how much of my capital is doing nothing", which is one proportion, not a
 * dataset.
 */
export function CapitalBar({ workingUsd, idleUsd }: CapitalBarProps) {
  const reduceMotion = useReducedMotion();
  const total = workingUsd + idleUsd;
  const workingPct = total > 0 ? (workingUsd / total) * 100 : 0;
  const idlePct = 100 - workingPct;

  const allIdle = workingUsd === 0 && idleUsd > 0;

  return (
    <div>
      <div
        className="relative flex h-2 w-full gap-1 overflow-hidden"
        role="img"
        aria-label={`${usd(workingUsd)} working, ${usd(idleUsd)} idle`}
      >
        {workingPct > 0 && (
          <div
            className="h-full rounded-full bg-mint transition-[width] duration-700 ease-out"
            style={{ width: `${workingPct}%` }}
          />
        )}
        {idlePct > 0 && (
          <div className="relative h-full flex-1 overflow-hidden rounded-full bg-graphite">
            {/* A fully idle portfolio would otherwise be a dead grey line at
                the exact moment the product is making its point. A slow mint
                sweep marks it as latent capital, not an empty state. */}
            {allIdle && !reduceMotion && (
              <motion.div
                className="absolute inset-y-0 w-1/3"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(63,226,128,0.35), transparent)",
                }}
                animate={{ x: ["-100%", "400%"] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                  repeatDelay: 0.8,
                }}
              />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        {/* Both terms are defined inline. "Working" and "Idle" are the
            product's vocabulary, not the user's — asserting them without
            saying what they mean is the fastest way to lose a first-time
            viewer. */}
        <Stat
          label="Working"
          sublabel="backing a loan"
          value={workingUsd}
          accent
          hint={allIdle ? "Nothing yet" : undefined}
        />
        {/* Idle is the larger number in the opening frame, but it is not the
            one to celebrate — keep it quiet so Working reads as the goal. */}
        <Stat
          label="Idle"
          sublabel="earning nothing"
          value={idleUsd}
          align="right"
          muted
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  sublabel,
  value,
  accent,
  align = "left",
  hint,
  muted,
}: {
  label: string;
  sublabel?: string;
  value: number;
  accent?: boolean;
  align?: "left" | "right";
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className={align === "right" ? "text-right" : undefined}>
      <div className="flex items-center gap-2" style={{ justifyContent: align === "right" ? "flex-end" : undefined }}>
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: accent ? "var(--color-signal-mint)" : "var(--surface-graphite)" }}
          aria-hidden
        />
        <span
          className="uppercase text-ash"
          style={{
            fontSize: "var(--text-caption)",
            letterSpacing: "var(--tracking-caption)",
          }}
        >
          {label}
        </span>
      </div>
      <div
        className="numeric mt-1"
        style={{
          // Shrink on narrow screens so an eight-figure sum cannot push the
          // page into horizontal scroll.
          fontSize: "clamp(18px, 5vw, var(--text-heading-sm))",
          lineHeight: "var(--leading-heading-sm)",
          color: accent
            ? "var(--color-signal-mint)"
            : muted
              ? "var(--color-ash)"
              : "var(--color-chalk)",
        }}
      >
        {usd(value)}
      </div>
      {(hint || sublabel) && (
        <div className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
          {hint ?? sublabel}
        </div>
      )}
    </div>
  );
}
