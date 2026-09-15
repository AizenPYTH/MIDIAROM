"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { publicMediaUrl } from "@/components/marketing/gallery";

/**
 * Le choix des photos d'un article.
 *
 * Il existait déjà un téléverseur, mais il rendait un **chemin à copier-coller**
 * dans un champ texte. Autant dire qu'on ne mettait pas de photo : la moitié
 * des articles partaient sans visuel, et un article sans visuel ne se vend pas.
 *
 * Ici, on choisit des fichiers, ils montent, on voit les vignettes, et les
 * chemins voyagent dans des champs cachés que le formulaire poste avec le
 * reste. Aucun copier-coller.
 *
 * La première photo est celle que la boutique montre en vignette : elle est
 * marquée, et n'importe quelle autre peut prendre sa place.
 */

const TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 10 * 1024 * 1024;

export function PhotoPicker({ name = "images", folder = "produits" }: { name?: string; folder?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const ajoutes: string[] = [];

    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) {
        setError(`${file.name} : formats acceptés JPEG, PNG, WebP ou AVIF.`);
        continue;
      }
      if (file.size > MAX) {
        setError(`${file.name} : 10 Mo maximum.`);
        continue;
      }
      const ext = file.type.split("/")[1] ?? "jpg";
      const chemin = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error: err } = await supabase.storage.from("content-media").upload(chemin, file, { contentType: file.type });
      if (err) setError(`${file.name} : ${err.message}`);
      else ajoutes.push(chemin);
    }

    setPaths((p) => [...p, ...ajoutes]);
    setBusy(false);
    // Sans ça, re-choisir le même fichier ne déclenche aucun événement.
    if (input.current) input.current.value = "";
  };

  const retirer = (chemin: string) => setPaths((p) => p.filter((x) => x !== chemin));
  const mettreEnPremier = (chemin: string) => setPaths((p) => [chemin, ...p.filter((x) => x !== chemin)]);

  return (
    <div className="flex flex-col gap-3">
      {/* Les chemins voyagent avec le formulaire : pas de copier-coller. */}
      {paths.map((p) => (
        <input key={p} type="hidden" name={name} value={p} />
      ))}

      <input
        ref={input}
        id="photos"
        type="file"
        accept={TYPES.join(",")}
        multiple
        className="sr-only"
        onChange={(e) => onFiles(e.target.files)}
      />

      {paths.length ? (
        <ul className="grid list-none gap-2.5 p-0" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
          {paths.map((p, i) => (
            <li key={p} className="relative">
              <span className="relative block aspect-square overflow-hidden border border-border bg-surface-strong">
                {/* Vignette locale de contrôle : le composant Image de Next
                    exigerait de déclarer l'hôte de stockage, et on ne gagne
                    rien à optimiser une image qu'on regarde deux secondes. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicMediaUrl(p)} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </span>
              {i === 0 ? (
                <span className="absolute left-1.5 top-1.5 bg-ink px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-white">
                  Vignette
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => mettreEnPremier(p)}
                  className="absolute left-1.5 top-1.5 cursor-pointer border border-border-strong bg-bg/90 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.07em] text-ink hover:border-ink"
                >
                  Mettre devant
                </button>
              )}
              <button
                type="button"
                onClick={() => retirer(p)}
                aria-label="Retirer cette photo"
                className="absolute right-1.5 top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center border border-border-strong bg-bg/90 text-[15px] leading-none text-ink hover:border-red hover:text-red"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="cursor-pointer border border-ink px-5 py-2.5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white disabled:opacity-50"
        >
          {busy ? "Envoi…" : paths.length ? "Ajouter une photo" : "Choisir des photos"}
        </button>
        <span className="text-[13px] text-ink-muted">JPEG, PNG, WebP ou AVIF · 10 Mo par photo</span>
      </div>

      {error ? (
        <p role="alert" className="border border-danger bg-danger-soft px-3.5 py-2.5 text-[13.5px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
