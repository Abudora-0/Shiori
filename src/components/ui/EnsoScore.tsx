"use client";

/**
 * Score displayed inside an ensō (円相) brush circle.
 * `score` is 0–100 internal; rendered as 10-point.
 */
export function EnsoScore({
  score,
  size = 96,
  label,
}: {
  score?: number;
  size?: number;
  label?: string;
}) {
  const pct = score ? Math.min(score, 100) / 100 : 0;
  const r = 42;
  const circumference = 2 * Math.PI * r;
  // Ensō circles are traditionally left slightly open
  const maxArc = circumference * 0.92;
  const arc = maxArc * pct;
  const display =
    score && score > 0 ? (score / 10).toFixed(1).replace(/\.0$/, "") : "-";

  return (
    <div
      className="relative flex flex-col items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-[100deg]">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--ink-600)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${maxArc} ${circumference}`}
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeDasharray={`${arc} ${circumference}`}
          style={{
            filter: "drop-shadow(0 0 4px rgba(212,175,55,0.5))",
            transition: "stroke-dasharray 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </svg>
      <span
        className="font-display font-bold text-gold"
        style={{ fontSize: size * 0.3 }}
      >
        {display}
      </span>
      {label && (
        <span className="text-[10px] uppercase tracking-widest text-faint">
          {label}
        </span>
      )}
    </div>
  );
}
