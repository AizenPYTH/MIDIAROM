import Link from "next/link";
import { Wrench } from "lucide-react";
import { ROUTES } from "@/config/site";
import { getBrandSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const brand = await getBrandSettings();
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center px-4 py-12">
      <Link href={ROUTES.home} className="mb-8 flex items-center gap-2.5 font-semibold text-ink">
        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-white">
          <Wrench className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
        {brand.name}
      </Link>
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
