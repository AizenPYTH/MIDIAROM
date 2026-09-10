import { EntityListPage } from "@/components/admin/entity-pages";
import { PublicMediaUploader } from "@/components/admin/public-media-uploader";

export default function Page() {
  return <EntityListPage entityKey="console_models" description="Chaque modèle sert à la fois au parcours de réparation et à la boutique. Téléversez la photo du modèle ci-dessous puis collez son chemin dans le champ « Image » de la fiche." extra={<PublicMediaUploader folder="consoles" />} />;
}
