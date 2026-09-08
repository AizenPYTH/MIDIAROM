import { EntityListPage } from "@/components/admin/entity-pages";

export default function Page() {
  return <EntityListPage entityKey="test_checklists" description="Checklists de contrôle qualité utilisées avant expédition. Une checklist par modèle, ou générique." />;
}
