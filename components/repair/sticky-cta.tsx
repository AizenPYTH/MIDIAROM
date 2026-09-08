import { ButtonLink } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils/format";

/** Mobile sticky bar: repair name + price + CTA (always visible while scrolling). */
export function StickyCta({ label, priceCents, href, cta }: { label: string; priceCents: number; href: string; cta: string }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 p-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{label}</p>
          <p className="text-sm font-bold text-primary">{formatPrice(priceCents)}</p>
        </div>
        <ButtonLink href={href} variant="accent" size="md">
          {cta}
        </ButtonLink>
      </div>
    </div>
  );
}
