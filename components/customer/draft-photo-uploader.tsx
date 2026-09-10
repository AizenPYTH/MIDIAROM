"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

/**
 * Zone « déposez photos / vidéo » du handoff : dépôt direct dans le bucket privé
 * `customer-media` (préfixe `drafts/`, limites du bucket), avant la création de la
 * demande. Le serveur rattache ensuite les fichiers au dossier ou à la reprise.
 */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };
const MAX_BYTES = 25 * 1024 * 1024;

export interface DraftPhoto {
  path: string;
  name: string;
  preview: string;
}

export function DraftPhotoUploader({
  photos,
  onChange,
  max = 6,
  label = "déposez photos de la panne",
  phoneLabel,
  className,
}: {
  photos: DraftPhoto[];
  onChange: (photos: DraftPhoto[]) => void;
  max?: number;
  label?: string;
  /** Libellé du bouton d'appareil photo, affiché au téléphone seulement. */
  phoneLabel?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const draftId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    draftId.current ??= crypto.randomUUID();
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= max) {
        setError(`${max} photos maximum.`);
        break;
      }
      if (!ACCEPTED.includes(file.type)) {
        setError(`${file.name} : format non accepté (JPEG, PNG, WebP, HEIC).`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setError(`${file.name} : fichier trop volumineux (25 Mo max).`);
        continue;
      }
      const path = `drafts/${draftId.current}/${crypto.randomUUID()}.${EXT[file.type]}`;
      const { error: uploadError } = await supabase.storage.from("customer-media").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(`${file.name} : ${uploadError.message}`);
        continue;
      }
      next.push({ path, name: file.name, preview: URL.createObjectURL(file) });
    }
    onChange(next);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input ref={inputRef} type="file" accept={ACCEPTED.join(",")} multiple className="sr-only" id="draft-photos" onChange={(e) => upload(e.target.files)} disabled={busy} />
      {/* Au téléphone, la panne se photographie sur place : `capture` ouvre
          directement l'appareil photo arrière. Le bouton de dépôt reste à côté
          pour choisir une photo déjà prise — `capture` seul enlèverait cet
          accès à la galerie. */}
      {phoneLabel ? (
        <>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" id="draft-photos-camera" onChange={(e) => upload(e.target.files)} disabled={busy} />
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={busy || photos.length >= max}
            className="cursor-pointer bg-ink-900 px-4 py-[14px] font-mono text-[11.5px] uppercase tracking-[0.06em] text-paper disabled:cursor-not-allowed disabled:opacity-40 sm:hidden"
          >
            {phoneLabel}
          </button>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          upload(e.dataTransfer.files);
        }}
        disabled={busy || photos.length >= max}
        className="cursor-pointer border border-dashed border-[rgba(20,18,15,0.3)] p-[22px] text-center font-mono text-[11.5px] tracking-[0.04em] text-[#7c7565] disabled:cursor-not-allowed"
        style={{ background: "repeating-linear-gradient(135deg, #eee9dc 0 7px, #f4f0e5 7px 14px)" }}
      >
        {busy ? "envoi en cours…" : photos.length >= max ? `${max} photos maximum` : `${label} (${photos.length}/${max})`}
      </button>
      {photos.length ? (
        <ul className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <li key={p.path} className="relative h-16 w-16 border border-[rgba(20,18,15,0.22)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- aperçu local (object URL) */}
              <img src={p.preview} alt={p.name} className="h-full w-full object-cover" />
              <button type="button" onClick={() => onChange(photos.filter((x) => x.path !== p.path))} aria-label={`Retirer ${p.name}`} className="absolute -right-1 -top-1 h-6 w-6 cursor-pointer bg-ink-900 font-mono text-[12px] leading-none text-paper sm:h-5 sm:w-5 sm:text-[11px]">
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
