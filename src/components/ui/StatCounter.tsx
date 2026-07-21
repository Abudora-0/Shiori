"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";

export function StatCounter({
  value,
  label,
  suffix = "",
  decimals = 0,
}: {
  value: number;
  label: string;
  suffix?: string;
  decimals?: number;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) => v.toFixed(decimals));

  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return controls.stop;
  }, [value, mv]);

  return (
    <div className="rounded-xl border border-line bg-ink-850 px-4 py-3.5">
      <div className="font-display text-2xl font-bold text-text md:text-3xl">
        <motion.span>{rounded}</motion.span>
        <span className="ml-0.5 text-base text-muted">{suffix}</span>
      </div>
      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-faint">
        {label}
      </div>
    </div>
  );
}
