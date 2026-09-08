import { EntityListPage } from "@/components/admin/entity-pages";

export default function Page() {
  return <EntityListPage entityKey="repairs" description="Une réparation = un modèle × une panne, avec son prix, son délai, sa garantie et son contenu SEO." />;
}
