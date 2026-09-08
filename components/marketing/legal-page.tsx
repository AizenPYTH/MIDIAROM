import { Container, PageHeader } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";
import { renderMarkdown } from "@/lib/utils/markdown";
import { formatDate } from "@/lib/utils/format";
import type { Tables } from "@/types/database";

export function LegalPage({ document, fallbackTitle }: { document: Tables<"legal_documents"> | null; fallbackTitle: string }) {
  return (
    <Container className="max-w-3xl py-10 sm:py-14">
      <PageHeader title={document?.title ?? fallbackTitle} description={document ? `Version ${document.version} · publiée le ${formatDate(document.published_at)}` : undefined} />
      {document ? (
        <div className="prose-cms mt-8" dangerouslySetInnerHTML={{ __html: renderMarkdown(document.body) }} />
      ) : (
        <Alert tone="warning" className="mt-8" title="Document en préparation">
          Ce document sera publié depuis le back-office après validation.
        </Alert>
      )}
    </Container>
  );
}
