import { redirect } from "next/navigation";
import { ROUTES } from "@/config/site";

export default function AccountIndexPage() {
  redirect(ROUTES.accountOrders);
}
