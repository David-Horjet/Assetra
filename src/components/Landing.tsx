"use client";

import { usePrivy } from "@privy-io/react-auth";
import { motion } from "motion/react";

/**
 * Landing / connect.
 *
 * One claim, one action. The value proposition has to land before a judge
 * decides whether to keep looking.
 */
export function Landing() {
  const { login, ready } = usePrivy();

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div
          className="mx-auto h-9 w-9 rounded-xl"
          style={{ background: "var(--color-signal-mint)" }}
          aria-hidden
        />

        <h1
          className="rise mx-auto mt-9 max-w-md"
          style={{
            fontFamily: "var(--font-aeonik)",
            fontSize: "clamp(32px, 7vw, var(--text-heading))",
            lineHeight: "var(--leading-heading)",
            letterSpacing: "-0.5px",
            fontWeight: "var(--font-weight-medium)",
          }}
        >
          Turn your stocks into working capital.
        </h1>

        <p
          className="rise mx-auto mt-5 max-w-sm text-ash"
          style={{ fontSize: "var(--text-body)", animationDelay: "0.08s" }}
        >
          Borrow against tokenized stocks on Solana — without selling them.
        </p>

        <motion.button
          type="button"
          onClick={login}
          disabled={!ready}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="rise mt-10 inline-flex items-center gap-3 px-8 py-4 text-abyss disabled:opacity-50"
          style={{
            borderRadius: "var(--radius-herobutton)",
            background: "var(--color-signal-mint)",
            fontSize: "var(--text-body)",
            fontWeight: "var(--font-weight-medium)",
            animationDelay: "0.16s",
          }}
        >
          Connect wallet
          <span aria-hidden>→</span>
        </motion.button>

        <p
          className="rise mt-8 text-ash"
          style={{ fontSize: "var(--text-caption)", animationDelay: "0.24s" }}
        >
          Works with NVDAx, SPYx, QQQx and TSLAx · Powered by Jupiter Lend
        </p>
      </div>
    </main>
  );
}
