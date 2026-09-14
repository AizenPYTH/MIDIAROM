/**
 * Fait comprendre à Node les imports du projet.
 *
 * Les scripts de vérification appellent le vrai code de l'application — c'est
 * tout leur intérêt : `npm run check:hlj` doit emprunter le chemin exact de
 * l'écran d'import, sinon il ne vérifie rien. Or ce code écrit ses imports
 * comme le reste du projet, en `@/…`, et Node ne connaît que les chemins
 * relatifs et les paquets. Deux ajustements suffisent :
 *
 *   · `@/x` devient un chemin depuis la racine, avec l'extension retrouvée ;
 *   · `--conditions=react-server` (posé dans package.json) pour que le paquet
 *     `server-only` se résolve sur son fichier vide au lieu de lever.
 *
 * Aucune transformation du code : Node 22 retire lui-même les annotations de
 * type. Ce fichier ne sert qu'à la résolution.
 *
 *   node --conditions=react-server --import ./scripts/lib/alias.mjs mon-script.mjs
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";

const RACINE = new URL("../../", import.meta.url);
/** Ce qu'on essaie d'ajouter quand l'import n'a pas d'extension, dans l'ordre. */
const SUFFIXES = ["", ".ts", ".tsx", ".mts", ".js", "/index.ts", "/index.tsx"];

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const base = new URL(specifier.slice(2), RACINE);
    for (const suffixe of SUFFIXES) {
      const candidat = new URL(base.href + suffixe);
      if (existsSync(candidat)) return { url: candidat.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
