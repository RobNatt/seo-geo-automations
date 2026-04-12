import { clientReportBrandName } from "@/lib/sites/client-report-access";

export default function ClientReportLayout({ children }: { children: React.ReactNode }) {
  const brand = clientReportBrandName();
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white px-4 py-5 dark:border-zinc-800 dark:bg-zinc-950">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
          {brand}
        </p>
      </header>
      <div className="px-4 py-8 sm:py-12">{children}</div>
      <footer className="border-t border-zinc-200 px-4 py-8 text-center text-[12px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
        This summary is prepared for your review. For questions or changes, contact your account team.
      </footer>
    </div>
  );
}
