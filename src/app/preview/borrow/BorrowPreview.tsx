"use client";

import { BorrowSheet } from "@/components/BorrowSheet";
import type { Holding } from "@/lib/types";

export function BorrowPreview({ holding }: { holding: Holding }) {
  return (
    <BorrowSheet holding={holding} onClose={() => {}} onConfirm={() => {}} />
  );
}
