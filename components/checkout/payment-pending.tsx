"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Polls the confirmation page while the payment webhook is in flight. */
export function PaymentPendingRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
