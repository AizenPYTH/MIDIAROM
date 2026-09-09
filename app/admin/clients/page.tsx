import { redirect } from "next/navigation";

/** Alias : la section « Clients » vit sous /admin/customers. */
export default function ClientsAlias() {
  redirect("/admin/customers");
}
