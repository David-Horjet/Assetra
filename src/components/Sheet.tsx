"use client";

import { motion } from "motion/react";
import { useEffect } from "react";

/**
 * Modal sheet shared by buy, borrow and earn.
 *
 * One primitive rather than three so the flows stay visually identical and
 * keyboard, focus and scroll behaviour are fixed in one place. Presents as a
 * bottom sheet on phones and a centred dialog on wider screens.
 */
export function Sheet({
  title,
  subtitle,
  logo,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  logo?: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Escape closes, and the page behind must not scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: 28, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 28, opacity: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl border sm:rounded-2xl"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--surface-carbon)",
          maxHeight: "92vh",
        }}
      >
        <div className="overflow-y-auto px-6 py-7" style={{ maxHeight: "92vh" }}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              )}
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{
                    fontFamily: "var(--font-aeonik)",
                    fontSize: "var(--text-subheading)",
                  }}
                >
                  {title}
                </div>
                {subtitle && (
                  <div
                    className="truncate text-ash"
                    style={{ fontSize: "var(--text-caption)" }}
                  >
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full px-2 py-1 text-ash transition-colors hover:text-chalk"
              style={{ fontSize: "var(--text-subheading)" }}
            >
              ×
            </button>
          </div>

          <div className="mt-8">{children}</div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** A label/value row inside a sheet's detail card. */
export function SheetRow({
  label,
  children,
  last,
}: {
  label: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3.5"
      style={{
        borderBottom: last ? undefined : "1px solid var(--border-subtle)",
      }}
    >
      <span className="text-ash" style={{ fontSize: "var(--text-caption)" }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--text-caption)" }}>{children}</span>
    </div>
  );
}
