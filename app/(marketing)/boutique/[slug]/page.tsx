import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ROUTES, SITE_URL } from "@/config/site";
import { Breadcrumbs, Container, Eyebrow } from "@/components/ui/misc";
import { publicMediaUrl } from "@/components/marketing/gallery";
import { AddToCartButton } from "@/components/shop/cart-widgets";
import { ProductCard } from "@/components/shop/product-card";
import { getProductBySlug, getProducts } from "@/lib/shop/catalog";
import { CATEGORY_LABELS, CATEGORY_SLUGS, CONDITION_DESCRIPTIONS, CONDITION_LABELS, stockLabel, stockState } from "@/lib/shop/status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { formatPrice } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Article introuvable" };
  return {
    title: `${product.name} — ${formatPrice(product.price_cents)}`,
    description: product.description ?? `${product.name} (${CONDITION_LABELS[product.condition]}) en vente au magasin et en ligne.`,
    alternates: { canonical: `${SITE_URL}${ROUTES.shop}/${product.slug}` },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();
  const db = createSupabaseAdminClient();
  const [shop, model, related] = await Promise.all([
    getSetting("shop"),
    product.model_id ? db.from("console_models").select("slug, name").eq("id", product.model_id).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    getProducts({ platform: product.platform, availability: "stock" }, 5),
  ]);
  const specs = Object.entries((product.specs ?? {}) as Record<string, string>);
  const state = stockState(product.quantity, product.low_stock_threshold);
  const others = related.filter((p) => p.id !== product.id).slice(0, 4);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.description ?? undefined,
    itemCondition: product.condition === "NEW" ? "https://schema.org/NewCondition" : product.condition === "REFURBISHED" ? "https://schema.org/RefurbishedCondition" : "https://schema.org/UsedCondition",
    offers: { "@type": "Offer", price: (product.price_cents / 100).toFixed(2), priceCurrency: "EUR", availability: product.quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE_URL}${ROUTES.shop}/${product.slug}` },
  };

  return (
    <Container className="py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Breadcrumbs items={[{ label: "Boutique", href: ROUTES.shop }, { label: CATEGORY_LABELS[product.category], href: `${ROUTES.shop}?cat=${CATEGORY_SLUGS[product.category]}` }, { label: product.name }]} />
      <div className="mt-6 grid gap-10 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
        <div className="flex flex-col gap-2">
          <div className="relative aspect-square border border-border">
            {product.images[0] ? <Image src={publicMediaUrl(product.images[0])} alt={product.name} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" priority /> : <div className="photo-placeholder h-full w-full text-[11.5px]">photo produit</div>}
            <span className={cn("absolute left-3 top-3 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[0.06em]", product.condition === "NEW" ? "bg-ink-900 text-paper" : "bg-sale text-white")}>{CONDITION_LABELS[product.condition]}</span>
          </div>
          {product.images.length > 1 ? (
            <div className="grid grid-cols-4 gap-2">
              {product.images.slice(1, 5).map((img) => (
                <div key={img} className="relative aspect-square border border-border">
                  <Image src={publicMediaUrl(img)} alt="" fill sizes="25vw" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <Eyebrow>
            {product.platform} · {CATEGORY_LABELS[product.category]}
          </Eyebrow>
          <h1 className="text-[clamp(26px,3vw,36px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">{product.name}</h1>
          <p className="font-mono text-[11.5px] uppercase tracking-[0.06em] text-ink-muted">Réf. {product.sku}</p>
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[30px] font-semibold text-ink">{formatPrice(product.price_cents)}</span>
            {product.compare_at_price_cents && product.compare_at_price_cents > product.price_cents ? <span className="font-mono text-[14px] text-ink-muted line-through">{formatPrice(product.compare_at_price_cents)}</span> : null}
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-muted">TTC</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AddToCartButton productId={product.id} available={product.quantity} size="md" />
            <span className={cn("font-mono text-[12px] uppercase tracking-[0.06em]", state === "OUT" ? "text-danger" : state === "LOW" ? "text-sale" : "text-ink-muted")}>{stockLabel(product.quantity, product.low_stock_threshold, product.condition)}</span>
          </div>
          <div className="border border-border p-4">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">État</span>
            <p className="mt-1 text-[15px] font-semibold text-ink">{CONDITION_LABELS[product.condition]}</p>
            <p className="mt-1 text-[14px] text-ink-soft">{CONDITION_DESCRIPTIONS[product.condition]}</p>
            {product.condition_notes ? <p className="mt-2 border-t border-dotted border-border-strong pt-2 text-[14px] text-ink">Défauts / précisions : {product.condition_notes}</p> : null}
          </div>
          {product.description ? <p className="text-[16px] leading-[1.55] text-ink-soft">{product.description}</p> : null}
          {specs.length ? (
            <dl className="flex flex-col gap-2 text-[14.5px]">
              {specs.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-dotted border-border-strong pb-1.5">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="text-right font-mono text-ink">{v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {product.includes.length ? (
            <div>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Contenu</span>
              <ul className="mt-1 flex flex-wrap gap-2">
                {product.includes.map((i) => (
                  <li key={i} className="border border-border-strong px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink">
                    {i}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="bg-ink-900 p-4 text-paper">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-muted">Retrait et envoi</span>
            <ul className="mt-2 flex flex-col gap-1.5 text-[14px] text-[#c4bdae]">
              {shop.pickup_enabled ? <li>Retrait au magasin — 0 €. {shop.pickup_note}</li> : null}
              {shop.shipping_enabled ? (
                <li>
                  Envoi — {formatPrice(shop.shipping_fee_cents)}
                  {shop.free_shipping_threshold_cents ? `, offert dès ${formatPrice(shop.free_shipping_threshold_cents)}` : ""}. {shop.shipping_note}
                </li>
              ) : null}
            </ul>
          </div>
          {model ? (
            <p className="font-mono text-[12px] uppercase tracking-[0.06em] text-ink-muted">
              Fiche console :{" "}
              <Link href={`${ROUTES.consoles}/${model.slug}`} className="text-sale underline underline-offset-4">
                {model.name}
              </Link>
              {" · "}
              <Link href={`${ROUTES.repair}/${model.slug}`} className="text-sale underline underline-offset-4">
                Réparations {model.name}
              </Link>
            </p>
          ) : null}
        </div>
      </div>
      {others.length ? (
        <section className="mt-16">
          <Eyebrow>Dans le même rayon</Eyebrow>
          <div className="mt-4 grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(230px,1fr))]">
            {others.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      ) : null}
    </Container>
  );
}
