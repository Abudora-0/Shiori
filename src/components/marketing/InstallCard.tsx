import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function InstallCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="card-glow relative overflow-hidden rounded-2xl border border-line bg-ink-850 p-6 md:p-8">
      <div className="seigaiha absolute inset-0 opacity-[0.03]" aria-hidden />
      <div className="relative">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-vermillion bg-ink-900 text-vermillion-bright">
          <Icon size={22} strokeWidth={1.8} />
        </div>
        <h3 className="mt-4 font-display text-xl font-bold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted">{description}</p>
        {children}
      </div>
    </div>
  );
}

export function InstallSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="mt-5 space-y-2 text-sm text-muted">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-700 text-[11px] font-semibold text-faint">
            {i + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
