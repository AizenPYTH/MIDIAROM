import Link from "next/link";
import { ROUTES } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";
import { BrandMark } from "@/components/marketing/header";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrandSettings();
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center bg-bg px-4 py-12">
      <Link href={ROUTES.home} className="mb-8 text-ink" aria-label={`${brand.name} — accueil`}>
        <BrandMark name={brand.name} />
      </Link>
      <div className="w-full max-w-md border border-border bg-surface p-[26px] sm:p-8">{children}</div>
    </main>
  );
}
