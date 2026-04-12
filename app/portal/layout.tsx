import { portalProductName, portalSupportLine } from "@/lib/product-portal/offering";

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const name = portalProductName();
  const footer = portalSupportLine();
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          {name}
        </p>
      </header>
      <div className="px-4 py-8 sm:py-12">{children}</div>
      <footer className="border-t border-zinc-200 px-4 py-8 text-center text-[12px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        {footer}
      </footer>
    </div>
  );
}
