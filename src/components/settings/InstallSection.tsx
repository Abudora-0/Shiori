import { Download } from "lucide-react";
import { InstallButton } from "@/components/settings/InstallButton";

export function InstallSection() {
  return (
    <section className="rounded-xl border border-line bg-ink-850 p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Download size={17} className="text-vermillion-bright" /> Install Shiori
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">
        Install it to open Shiori in its own window, with no browser chrome, straight
        to your shelf.
      </p>

      <div className="mt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-faint">
              Desktop
            </span>
            <p className="mt-1 text-xs text-muted">
              Chrome or Edge: click the install icon in the address bar, or use the
              button here.
            </p>
          </div>
          <InstallButton label="Install for desktop" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-faint">
              Android
            </span>
            <p className="mt-1 text-xs text-muted">
              If the button below doesn&apos;t appear, open Chrome&apos;s menu (three
              dots) and choose &quot;Add to Home screen&quot; or &quot;Install
              app&quot; instead. That always works, prompt or not.
            </p>
          </div>
          <InstallButton label="Install for Android" />
        </div>

        <div className="border-t border-line pt-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-faint">
            iPhone
          </span>
          <p className="mt-1 text-xs text-muted">
            Safari doesn&apos;t offer a one-tap install. Tap the Share icon, then
            &quot;Add to Home Screen&quot;.
          </p>
        </div>
      </div>
    </section>
  );
}
