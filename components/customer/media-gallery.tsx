import { FileText, Video } from "lucide-react";
import type { OrderMedia } from "@/lib/media/service";
import { formatDateTime } from "@/lib/utils/format";

export function MediaGallery({ media, emptyText = "Aucun fichier pour le moment." }: { media: (OrderMedia & { url: string | null })[]; emptyText?: string }) {
  if (!media.length) return <p className="text-sm text-ink-muted">{emptyText}</p>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {media.map((m) => (
        <li key={m.id} className="overflow-hidden rounded-md border border-border bg-surface">
          {m.url ? (
            <a href={m.url} target="_blank" rel="noopener noreferrer" className="block">
              {m.is_video ? (
                <video src={m.url} className="aspect-square w-full bg-black object-cover" preload="metadata" muted />
              ) : m.mime_type === "application/pdf" ? (
                <div className="flex aspect-square items-center justify-center bg-surface-muted text-ink-muted">
                  <FileText className="h-8 w-8" aria-hidden="true" />
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- signed URLs expire; next/image optimisation is not desirable here
                <img src={m.url} alt={m.caption ?? m.original_name ?? "Photo du dossier"} className="aspect-square w-full object-cover" loading="lazy" />
              )}
            </a>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-surface-muted text-ink-muted">
              {m.is_video ? <Video className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            </div>
          )}
          <div className="px-2 py-1.5 text-[11px] text-ink-muted">
            <p className="truncate text-ink">{m.caption ?? m.original_name ?? "Fichier"}</p>
            <p>{formatDateTime(m.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
