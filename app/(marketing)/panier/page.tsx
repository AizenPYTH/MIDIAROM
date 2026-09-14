import type { Metadata } from "next";
import { Container, Eyebrow } from "@/components/ui/misc";
import { CartPage } from "@/components/shop/cart-page";

export const metadata: Metadata = { title: "Panier", robots: { index: false, follow: false } };

export default function CartRoute() {
  return (
    <Container className="py-12">
      <Eyebrow>Boutique</Eyebrow>
      <h1 className="mb-8 mt-2 text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink">Votre panier</h1>
      <CartPage />
    </Container>
  );
}
