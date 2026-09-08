"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { BUCKET_FOR_KIND, buildStoragePath, validateUpload, type MediaKind } from "@/lib/security/upload";
import { registerMediaAction } from "@/app/(account)/compte/actions";

/**
 * Direct browser → Supabase Storage upload (no proxy through Next.js).
 * Storage RLS + bucket limits enforce who can write where and what.
 * The server then registers the file after re-checking ownership.
 */
export function MediaUploader({
  orderId,
  kind,
  accept = "image/*,video/*",
  label = "Ajouter des photos / vidéos",
  visibleToCustomer,
  captionPrompt,
}: {
  orderId: string;
  kind: MediaKind;
  accept?: string;
  label?: string;
  visibleToCustomer?: boolean;
  captionPrompt?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const bucket = BUCKET_FOR_KIND[kind];
    let done = 0;
    for (const file of Array.from(files)) {
      const validation = validateUpload(file, kind);
      if (!validation.ok) {
        setError(`${file.name} : ${validation.error}`);
        continue;
      }
      const path = buildStoragePath(orderId, kind, validation.extension);
      setProgress(`Envoi ${done + 1}/${files.length}…`);
      const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) {
        setError(`${file.name} : ${uploadError.message}`);
        continue;
      }
      const caption = captionPrompt ? window.prompt(`Légende pour ${file.name} (facultatif)`) : null;
      const result = await registerMediaAction({ orderId, kind, path, mimeType: file.type, sizeBytes: file.size, originalName: file.name, caption, visibleToCustomer });
      if (!result.ok) setError(result.error);
      done += 1;
    }
    setProgress(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept={accept} multiple className="sr-only" id={`upload-${kind}-${orderId}`} onChange={(e) => onFiles(e.target.files)} disabled={busy} />
      <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" aria-hidden="true" /> {progress ?? label}
      </Button>
      <div className="mt-2">
        <FormError message={error} />
      </div>
    </div>
  );
}
