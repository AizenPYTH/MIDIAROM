#!/usr/bin/env node
/**
 * Importe les photos des 13 modèles de console détaillés dans le catalogue de
 * réparation du client, depuis un dossier local.
 *
 *   node scripts/import-console-photos.mjs <dossier> [--dry-run] [--out <dossier>]
 *
 * Ce que fait le script, fichier par fichier :
 *   1. il rapproche le nom du fichier de l'un des 13 slugs attendus ;
 *   2. il identifie le VRAI contenu par ses octets d'en-tête, pas par son
 *      extension : une page enregistrée depuis Chrome se nomme souvent « .jpg » ;
 *   3. si c'est une page HTML ou MHTML, il en extrait l'image d'origine
 *      lorsqu'elle s'y trouve — image encodée en base64, ou fichier voisin
 *      déposé par Chrome dans « <nom>_files/ ». Sinon il s'arrête sur ce
 *      fichier et le signale : RIEN n'est jamais téléchargé depuis Internet ;
 *   4. il convertit en WebP, grand côté ramené à 1200 px maximum (jamais
 *      agrandi), qualité 85 ;
 *   5. il téléverse dans le bucket public content-media, sous consoles/<slug>.webp,
 *      et renseigne console_models.image_path du modèle correspondant.
 *
 * Le nom de fichier dans le stockage est le slug, pas un identifiant aléatoire :
 * réimporter une photo corrigée écrase la précédente au lieu d'accumuler des
 * objets orphelins.
 *
 * Seuls les 13 modèles listés ici peuvent être touchés. Les 26 autres modèles du
 * catalogue ne sont ni lus ni modifiés.
 *
 * Variables attendues : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 * (chargées depuis .env.local si présent).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "content-media";
const FOLDER = "consoles";
const MAX_SIDE = 1200;
const QUALITY = 85;

/**
 * Les 13 modèles du document du client, et les libellés sous lesquels leurs
 * photos arrivent réellement — coquilles du client comprises (« xbobx one »,
 * « swithc oled ») : mieux vaut les déclarer que laisser une approximation
 * rapprocher un fichier du mauvais modèle.
 * La comparaison se fait sur une forme normalisée
 * (minuscules, sans accent, sans ponctuation ni espace), ce qui absorbe
 * « PS4 FAT », « ps4-fat », « PS4_Fat (1).jpg »…
 */
const MODELS = [
  { slug: "ps4", label: "PS4 FAT", aliases: ["ps4fat", "ps4", "playstation4", "ps4standard"] },
  { slug: "ps4-slim", label: "PS4 Slim", aliases: ["ps4slim", "playstation4slim"] },
  { slug: "ps4-pro", label: "PS4 Pro", aliases: ["ps4pro", "playstation4pro"] },
  { slug: "switch", label: "Nintendo Switch V1", aliases: ["switchv1", "nintendoswitchv1", "switch1", "nintendoswitch", "switch"] },
  { slug: "switch-v2", label: "Nintendo Switch V2", aliases: ["switchv2", "nintendoswitchv2", "switch2019"] },
  { slug: "switch-lite", label: "Nintendo Switch Lite", aliases: ["switchlite", "nintendoswitchlite"] },
  { slug: "switch-oled", label: "Nintendo Switch OLED", aliases: ["switcholed", "nintendoswitcholed", "swithcoled"] },
  { slug: "switch-2", label: "Nintendo Switch 2", aliases: ["nintendoswitch2", "switch2"] },
  { slug: "xbox-one", label: "Xbox One", aliases: ["xboxone", "xbobxone"] },
  { slug: "xbox-one-s", label: "Xbox One S", aliases: ["xboxones"] },
  { slug: "xbox-one-x", label: "Xbox One X", aliases: ["xboxonex", "xbobxonex"] },
  { slug: "xbox-series-s", label: "Xbox Series S", aliases: ["xboxseriess"] },
  { slug: "xbox-series-x", label: "Xbox Series X", aliases: ["xboxseriesx"] },
];

const normalize = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,5}$/, "")
    .replace(/\(\d+\)/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Rapproche un nom de fichier d'un modèle. On retient l'alias le PLUS LONG qui
 * correspond : sans cela « switch v2 » serait capté par l'alias « switch » du
 * modèle V1, et « xbox one x » par celui de la Xbox One.
 */
function matchModel(filename) {
  const n = normalize(filename);
  let best = null;
  for (const m of MODELS) {
    for (const a of m.aliases) {
      if (n === a || n.startsWith(a) || n.endsWith(a) || n.includes(a)) {
        if (!best || a.length > best.alias.length) best = { model: m, alias: a };
      }
    }
  }
  return best?.model ?? null;
}

/** Type réel d'un fichier, déduit de ses premiers octets. */
function sniff(buf) {
  if (buf.length < 12) return "inconnu";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image";
  if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "image";
  if (buf.slice(0, 6).toString("ascii").startsWith("GIF8")) return "image";
  if (buf.slice(4, 12).toString("ascii").includes("ftyp")) return "image"; // AVIF / HEIC
  const head = buf.slice(0, 2048).toString("latin1").trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.startsWith("<meta")) return "html";
  if (head.startsWith("mime-version") || head.includes("content-type: multipart/related")) return "mhtml";
  if (head.startsWith("<?xml") || head.includes("<svg")) return "svg";
  return "inconnu";
}

/** Plus grande image encodée en base64 trouvée dans un document texte. */
function biggestDataUri(text) {
  let best = null;
  const re = /data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=\s]{512,})/g;
  for (const m of text.matchAll(re)) {
    const buf = Buffer.from(m[2].replace(/\s/g, ""), "base64");
    if (!best || buf.length > best.length) best = buf;
  }
  return best;
}

/** Plus grande image parmi les parties base64 d'un fichier MHTML. */
function biggestMhtmlPart(text) {
  let best = null;
  for (const part of text.split(/\r?\n--/)) {
    if (!/content-type:\s*image\//i.test(part)) continue;
    if (!/content-transfer-encoding:\s*base64/i.test(part)) continue;
    const body = part.split(/\r?\n\r?\n/).slice(1).join("\n");
    const buf = Buffer.from(body.replace(/[^A-Za-z0-9+/=]/g, ""), "base64");
    if (buf.length > 1024 && (!best || buf.length > best.length)) best = buf;
  }
  return best;
}

/** Plus grande image du dossier « <nom>_files/ » déposé par Chrome à côté du HTML. */
function biggestSidecar(htmlPath) {
  const base = basename(htmlPath, extname(htmlPath));
  const candidates = ["_files", "_fichiers", "_fichiers", " _files"].map((s) => join(dirname(htmlPath), base + s));
  let best = null;
  for (const dir of candidates) {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) continue;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!statSync(p).isFile()) continue;
      const buf = readFileSync(p);
      if (sniff(buf) !== "image") continue;
      if (!best || buf.length > best.buf.length) best = { buf, from: p };
    }
  }
  return best;
}

/**
 * Rend les octets d'image exploitables d'un fichier, ou explique pourquoi il n'y
 * en a pas. Aucun accès réseau : une page qui ne fait que POINTER vers une image
 * distante est signalée, pas téléchargée.
 */
function extractImage(path) {
  const buf = readFileSync(path);
  const kind = sniff(buf);
  if (kind === "image") return { buf, origine: "image directe" };
  if (kind === "svg") return { erreur: "fichier SVG : convertible mais rarement une photo de console, à valider avec le client" };
  if (kind === "html" || kind === "mhtml") {
    const text = buf.toString("latin1");
    const inline = kind === "mhtml" ? biggestMhtmlPart(text) : biggestDataUri(text);
    if (inline && sniff(inline) === "image") return { buf: inline, origine: `image intégrée au ${kind.toUpperCase()}` };
    const sidecar = biggestSidecar(path);
    if (sidecar) return { buf: sidecar.buf, origine: `image du dossier voisin (${basename(sidecar.from)})` };
    const distantes = [...text.matchAll(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)/gi)].map((m) => m[1]).slice(0, 3);
    return {
      erreur:
        `page ${kind.toUpperCase()} sans image exploitable en local` +
        (distantes.length ? ` — elle ne fait que pointer vers ${distantes.length} URL distante(s), non téléchargée(s)` : ""),
    };
  }
  return { erreur: `contenu non reconnu (${kind})` };
}

async function toWebp(buf) {
  const image = sharp(buf, { failOn: "none" });
  const meta = await image.metadata();
  const long = Math.max(meta.width ?? 0, meta.height ?? 0);
  const pipeline = long > MAX_SIDE ? image.resize({ width: meta.width >= meta.height ? MAX_SIDE : null, height: meta.height > meta.width ? MAX_SIDE : null, fit: "inside", withoutEnlargement: true }) : image;
  const out = await pipeline.webp({ quality: QUALITY, effort: 6 }).toBuffer({ resolveWithObject: true });
  return { buf: out.data, width: out.info.width, height: out.info.height, source: `${meta.width}x${meta.height} ${meta.format}` };
}

function loadEnv() {
  const p = join(ROOT, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : join(ROOT, ".photos-consoles");

if (!dir) {
  console.error("usage : node scripts/import-console-photos.mjs <dossier> [--dry-run] [--out <dossier>]");
  process.exit(2);
}
if (!existsSync(dir)) {
  console.error(`Dossier introuvable : ${dir}`);
  process.exit(2);
}

loadEnv();
mkdirSync(outDir, { recursive: true });

// 1. Rapprochement fichiers ↔ modèles
const entries = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
const parSlug = new Map();
const orphelins = [];
for (const f of entries) {
  const model = matchModel(f);
  if (!model) {
    orphelins.push(f);
    continue;
  }
  const known = parSlug.get(model.slug);
  // À égalité, on garde le plus gros fichier : une page HTML pèse moins qu'une photo.
  if (!known || statSync(join(dir, f)).size > statSync(join(dir, known)).size) parSlug.set(model.slug, f);
}

console.log(`Dossier : ${dir}`);
console.log(`${entries.length} fichier(s), ${parSlug.size} rapproché(s) des 13 modèles attendus\n`);

// 2. Extraction et conversion
const resultats = [];
for (const model of MODELS) {
  const file = parSlug.get(model.slug);
  if (!file) {
    resultats.push({ ...model, etat: "absent", detail: "aucun fichier ne correspond à ce modèle" });
    continue;
  }
  const { buf, origine, erreur } = extractImage(join(dir, file));
  if (erreur) {
    resultats.push({ ...model, fichier: file, etat: "bloqué", detail: erreur });
    continue;
  }
  try {
    const webp = await toWebp(buf);
    const cible = join(outDir, `${model.slug}.webp`);
    writeFileSync(cible, webp.buf);
    resultats.push({ ...model, fichier: file, etat: "prêt", detail: `${origine} · ${webp.source} → ${webp.width}x${webp.height} webp ${Math.round(webp.buf.length / 1024)} Ko`, cible });
  } catch (e) {
    resultats.push({ ...model, fichier: file, etat: "bloqué", detail: `conversion impossible : ${String(e.message).slice(0, 120)}` });
  }
}

const ICONE = { prêt: "✔", bloqué: "✘", absent: "·" };
for (const r of resultats) console.log(`${ICONE[r.etat]} ${r.label.padEnd(22)} ${r.slug.padEnd(14)} ${r.detail}`);
if (orphelins.length) console.log(`\nFichiers non rapprochés : ${orphelins.join(", ")}`);

const prêts = resultats.filter((r) => r.etat === "prêt");
const bloqués = resultats.filter((r) => r.etat !== "prêt");

if (dryRun) {
  console.log(`\n--dry-run : ${prêts.length} image(s) préparée(s) dans ${outDir}, rien n'a été téléversé.`);
  process.exit(bloqués.length ? 1 : 0);
}

// 3. Téléversement et association en base
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("\nNEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont nécessaires pour téléverser.");
  process.exit(2);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let televerses = 0;
for (const r of prêts) {
  const path = `${FOLDER}/${r.slug}.webp`;
  const bytes = readFileSync(r.cible);
  let { error: up } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: "image/webp", upsert: true });
  // Un objet déjà présent se remplace par update() : tous les back-ends de
  // stockage n'honorent pas upsert à l'upload, et réimporter une photo
  // corrigée doit écraser l'ancienne, pas échouer.
  if (up && /exist/i.test(up.message)) {
    ({ error: up } = await db.storage.from(BUCKET).update(path, bytes, { contentType: "image/webp" }));
  }
  if (up) {
    console.log(`✘ ${r.label} : téléversement refusé — ${up.message}`);
    continue;
  }
  // eq(slug) : seul le modèle visé est touché, jamais les 26 autres.
  const { error: db_, count } = await db.from("console_models").update({ image_path: path }, { count: "exact" }).eq("slug", r.slug);
  if (db_) console.log(`✘ ${r.label} : mise à jour refusée — ${db_.message}`);
  else if (!count) console.log(`✘ ${r.label} : aucun modèle « ${r.slug} » en base`);
  else {
    televerses++;
    console.log(`↑ ${r.label.padEnd(22)} → ${path}`);
  }
}

console.log(`\n${televerses} / 13 modèle(s) illustré(s).`);
if (bloqués.length) {
  console.log("À reprendre :");
  for (const r of bloqués) console.log(`  ${r.label} — ${r.detail}`);
}
process.exit(bloqués.length ? 1 : 0);
