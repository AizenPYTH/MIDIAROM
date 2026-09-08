"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";

/** Uploads public assets (workshop photos, illustrations) to the content-media bucket. Admin-only by storage RLS. */
export function PublicMediaUploader({ folder }: { folder: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [paths, setPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const done: string[] = [];
    for (const file of Array.from(files)) {
      if (!["image/jpeg", "image/png", "image/webp", "image/svg+xml"].includes(file.type) || file.size > 10 * 1024 * 1024) {
        setError(`${file.name} : image JPEG/PNG/WebP/SVG de 10 Mo max.`);
        continue;
      }
      const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1] ?? "jpg";
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: err } = await supabase.storage.from("content-media").upload(path, file, { contentType: file.type });
      if (err) setError(`${file.name} : ${err.message}`);
      else done.push(path);
    }
    setPaths((p) => [...done, ...p]);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  };
  return (
    <div className="rounded-lg border border-dashed border-border-strong bg-surface p-4">
      <p className="text-sm font-medium text-ink">Médias publics (content-media)</p>
      <p className="text-xs text-ink-muted">Téléversez une image puis copiez son chemin dans le champ « Image » de l&apos;élément.</p>
      <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" id="public-upload" onChange={(e) => onFiles(e.target.files)} />
      <Button type="button" variant="outline" size="sm" className="mt-2" loading={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" aria-hidden="true" /> Téléverser
      </Button>
      <div className="mt-2"><FormError message={error} /></div>
      {paths.length ? (
        <ul className="mt-2 space-y-1 font-mono text-xs text-ink">
          {paths.map((p) => <li key={p} className="select-all rounded bg-surface-muted px-2 py-1">{p}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
