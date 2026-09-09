import Link from "next/link";
import { formatPrice } from "@/lib/utils/format";

/** Barre mobile fixe : prestation + prix + CTA (toujours visible en défilant). */
export function StickyCta({ label, priceCents, href, cta }: { label: string; priceCents: number; href: string; cta: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg p-3 lg:hidden">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{label}</p>
          <p className="font-mono text-[14px] font-semibold text-ink">{formatPrice(priceCents)}</p>
        </div>
        <Link href={href} className="whitespace-nowrap bg-accent px-4 py-3 font-mono text-[12px] uppercase tracking-[0.06em] text-white hover:bg-ink-900">
          {cta}
        </Link>
      </div>
    </div>
  );
}
