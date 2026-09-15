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
              dots) and look for &quot;Add to Home screen&quot; or &quot;Install
              app&quot; instead.
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

      <p className="mt-4 border-t border-line pt-4 text-xs text-faint">
        Nothing showing up anywhere, not even &quot;Add to Home screen&quot; in your
        browser&apos;s menu? That&apos;s your phone or browser blocking app installs,
        not a problem with Shiori. It varies by device: try updating your browser,
        turning off Data Saver or Lite mode, or checking for a shortcut/autostart
        permission for it in your phone&apos;s app settings (common on Xiaomi, Oppo
        and Vivo phones).
      </p>
    </section>
  );
}
