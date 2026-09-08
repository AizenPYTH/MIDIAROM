import { EntityListPage } from "@/components/admin/entity-pages";
import { PublicMediaUploader } from "@/components/admin/public-media-uploader";

export default function Page() {
  return (
    <EntityListPage
      entityKey="gallery_items"
      description="Vraies photos de l'atelier, de l'équipe et des réparations. Rien n'est affiché tant qu'aucune photo n'est publiée."
      extra={<PublicMediaUploader folder="gallery" />}
    />
  );
}
