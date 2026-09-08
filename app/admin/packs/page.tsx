import { EntityListPage } from "@/components/admin/entity-pages";

export default function Page() {
  return <EntityListPage entityKey="packs" description="Un pack regroupe plusieurs options à un prix global. Il n'est proposé que si toutes ses options sont compatibles et qu'aucune n'est déjà incluse dans la réparation." />;
}
