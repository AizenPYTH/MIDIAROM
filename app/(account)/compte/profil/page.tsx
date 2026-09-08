import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteAccountForm, PasswordForm, ProfileForm } from "@/components/customer/forms";
import { requireUserOrRedirect } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Mon profil", robots: { index: false } };

export default async function ProfilePage() {
  const user = await requireUserOrRedirect();
  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" description={user.email} />
      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={user.profile} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mes données</CardTitle>
          <p className="text-sm text-ink-muted">Vous pouvez demander la suppression de votre compte. Les dossiers terminés sont conservés anonymisés pour nos obligations comptables.</p>
        </CardHeader>
        <CardContent>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </div>
  );
}
