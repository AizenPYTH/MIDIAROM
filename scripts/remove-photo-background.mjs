#!/usr/bin/env node
/**
 * Rend transparent le fond uni des photos de consoles.
 *
 *   node scripts/remove-photo-background.mjs <fichier|dossier>... [--out <dossier>]
 *
 * Trois précautions, imposées par les images elles-mêmes :
 *
 * 1. La couleur du fond n'est pas supposée : elle est LUE aux quatre coins.
 *    Douze photos sont sur blanc pur, celle de la Switch 2 sur noir.
 *
 * 2. Le fond est détecté par PROPAGATION DEPUIS LES BORDS, jamais par un seuil
 *    global. Quatre consoles sont blanches (Xbox One S, Series S, Series X,
 *    Switch OLED) : un seuil global les percerait de trous.
 *
 * 3. La tolérance de propagation est STRICTE (5 sur 255). Mesuré sur ces
 *    images : le fond est à 255 exactement, tandis que les carrosseries
 *    blanches plafonnent vers 248 sous l'effet des ombres. Une tolérance large
 *    ferait fuir la propagation dans la console et l'effacerait entièrement.
 *
 * Les bords sont traités dans une bande de deux pixels autour du fond détecté :
 * l'opacité y suit la distance à la couleur du fond, ce qui évite l'escalier
 * sans jamais rendre le sujet translucide. La part de fond mélangée aux pixels
 * semi-transparents est ensuite retirée pour supprimer le liseré.
 *
 * Le sujet n'est pas retouché : ni recadrage, ni redimensionnement, ni
 * correction de couleur. Seul le canal alpha est écrit — plus, sur les seuls
 * pixels de bord, le défrangeage.
 */
import { readFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import sharp from "sharp";

/** Tolérance de détection du fond, en valeur absolue sur 255. */
const TOL_FOND = 5;
/** Au-delà de cette distance à la couleur du fond, le pixel est pleinement opaque. */
const TOL_BORD = 40;
/** Largeur, en pixels, de la bande de transition autour du fond. */
const BANDE = 2;
/**
 * Écart maximal accepté d'un pixel au suivant lors de la passe « ombres ».
 * Mesuré sur ces images : à 6, la propagation franchit le contour des consoles
 * blanches (Xbox One S, Series S) et les perce. À 3, elle s'arrête net. Une
 * ombre portée résiduelle est un moindre mal comparé à une console trouée.
 */
const PAS_MAX = 3;
/** Distance maximale à la couleur du fond lors de la passe « ombres ». */
const ENVELOPPE = 52;
/** Au-delà de cette saturation, le pixel appartient au sujet, pas à une ombre. */
const CHROMA_MAX = 10;
/** Part minimale de l'image que le sujet doit conserver après la passe « ombres ». */
const SUJET_MIN = 0.12;

const dist = (data, i, bg) =>
  Math.max(Math.abs(data[i * 4] - bg[0]), Math.abs(data[i * 4 + 1] - bg[1]), Math.abs(data[i * 4 + 2] - bg[2]));

/**
 * Couleur du fond : médiane de tous les pixels du pourtour, et proportion du
 * pourtour qui s'y conforme. Plus robuste que quatre coins : une console qui
 * touche un coin, ou un léger bruit de compression, ne fausse pas la mesure.
 */
function couleurFond(data, width, height) {
  const bords = [];
  for (let x = 0; x < width; x++) {
    bords.push(x);
    bords.push((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    bords.push(y * width);
    bords.push(y * width + width - 1);
  }
  const canal = (c) => {
    const v = bords.map((i) => data[i * 4 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  };
  const bg = [canal(0), canal(1), canal(2)];
  const conformes = bords.filter((i) => dist(data, i, bg) <= TOL_FOND).length;
  return { bg, partBord: conformes / bords.length };
}

/**
 * Seconde passe : suit les variations DOUCES à partir du fond déjà trouvé.
 *
 * Les ombres portées et les fonds en léger dégradé sortent de la tolérance
 * stricte : ils s'étendent de 255 à ~215 sans rupture. On les rattrape en
 * n'acceptant qu'un écart minime avec le pixel voisin déjà classé fond
 * (PAS_MAX), tout en restant dans une enveloppe autour de la couleur du fond
 * (ENVELOPPE). Le contour d'une console, lui, saute de plusieurs dizaines de
 * niveaux en un ou deux pixels : la propagation s'y arrête.
 */
function etendreOmbres(data, width, height, bg, fond) {
  const n = width * height;
  const file = new Int32Array(n);
  let tete = 0;
  let queue = 0;
  for (let i = 0; i < n; i++) if (fond[i]) file[queue++] = i;

  const valeur = (i) => (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3;
  const chroma = (i) => {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  const tester = (voisin, depuis) => {
    if (fond[voisin]) return;
    if (dist(data, voisin, bg) > ENVELOPPE) return;
    // Une ombre reste neutre : un pixel coloré appartient au sujet.
    if (chroma(voisin) > CHROMA_MAX) return;
    if (Math.abs(valeur(voisin) - valeur(depuis)) > PAS_MAX) return;
    fond[voisin] = 1;
    file[queue++] = voisin;
  };

  while (tete < queue) {
    const i = file[tete++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) tester(i - 1, i);
    if (x < width - 1) tester(i + 1, i);
    if (y > 0) tester(i - width, i);
    if (y < height - 1) tester(i + width, i);
  }
}

/** Masque du fond : parcours en largeur depuis les bords, tolérance stricte. */
function masqueFond(data, width, height, bg) {
  const n = width * height;
  const fond = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0;
  let queue = 0;
  const pousser = (i) => {
    if (!fond[i] && dist(data, i, bg) <= TOL_FOND) {
      fond[i] = 1;
      file[queue++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    pousser(x);
    pousser((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pousser(y * width);
    pousser(y * width + width - 1);
  }
  while (tete < queue) {
    const i = file[tete++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) pousser(i - 1);
    if (x < width - 1) pousser(i + 1);
    if (y > 0) pousser(i - width);
    if (y < height - 1) pousser(i + width);
  }
  return fond;
}

/**
 * Rebouche les zones transparentes enfermées dans le sujet.
 *
 * Un fond est forcément relié au bord de l'image. Une poche transparente qui ne
 * l'est pas vient d'une fuite de la détection à l'intérieur de la console : on
 * la rend opaque. Renvoie le nombre de pixels rétablis.
 */
function boucherTrous(fond, width, height) {
  const n = width * height;
  const relie = new Uint8Array(n);
  const file = new Int32Array(n);
  let tete = 0;
  let queue = 0;
  const pousser = (i) => {
    if (fond[i] && !relie[i]) {
      relie[i] = 1;
      file[queue++] = i;
    }
  };
  for (let x = 0; x < width; x++) {
    pousser(x);
    pousser((height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    pousser(y * width);
    pousser(y * width + width - 1);
  }
  while (tete < queue) {
    const i = file[tete++];
    const x = i % width;
    const y = (i / width) | 0;
    if (x > 0) pousser(i - 1);
    if (x < width - 1) pousser(i + 1);
    if (y > 0) pousser(i - width);
    if (y < height - 1) pousser(i + width);
  }
  let rebouches = 0;
  for (let i = 0; i < n; i++) {
    if (fond[i] && !relie[i]) {
      fond[i] = 0;
      rebouches++;
    }
  }
  return rebouches;
}

/** Pixels situés à BANDE pixels ou moins d'un pixel de fond, sans en être. */
function bandeTransition(fond, width, height) {
  const n = width * height;
  let courant = fond;
  const bande = new Uint8Array(n);
  for (let pas = 0; pas < BANDE; pas++) {
    const suivant = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (courant[i]) continue;
      const x = i % width;
      const y = (i / width) | 0;
      const voisinFond =
        (x > 0 && courant[i - 1]) ||
        (x < width - 1 && courant[i + 1]) ||
        (y > 0 && courant[i - width]) ||
        (y < height - 1 && courant[i + width]);
      if (voisinFond) {
        suivant[i] = 1;
        bande[i] = 1;
      }
    }
    const fusion = new Uint8Array(n);
    for (let i = 0; i < n; i++) fusion[i] = courant[i] || suivant[i];
    courant = fusion;
  }
  return bande;
}

async function traiter(source, cible) {
  const { data, info } = await sharp(readFileSync(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  if (channels !== 4) throw new Error(`${channels} canaux au lieu de 4`);

  const { bg, partBord } = couleurFond(data, width, height);
  const strict = masqueFond(data, width, height, bg);

  // La passe « ombres » est tentée, puis validée. Sur un sujet blanc posé sur
  // fond blanc — la Xbox Series X — elle peut franchir le contour et effacer la
  // console. Si le sujet restant devient implausible, on garde le masque
  // strict, dont le contour est sûr.
  const avecOmbres = Uint8Array.from(strict);
  etendreOmbres(data, width, height, bg, avecOmbres);
  const n0 = width * height;
  const restant = (m) => {
    let k = 0;
    for (let i = 0; i < n0; i++) if (!m[i]) k++;
    return k / n0;
  };
  const ombresRetenues = restant(avecOmbres) >= SUJET_MIN;
  const fond = ombresRetenues ? avecOmbres : strict;
  const trous = boucherTrous(fond, width, height);
  const bande = bandeTransition(fond, width, height);

  const n = width * height;
  let retires = 0;
  for (let i = 0; i < n; i++) {
    let a = 255;
    if (fond[i]) {
      a = 0;
      retires++;
    } else if (bande[i]) {
      const d = dist(data, i, bg);
      a = Math.max(0, Math.min(255, Math.round((d / TOL_BORD) * 255)));
    }
    data[i * 4 + 3] = a;

    // Défrangeage : un pixel semi-transparent est un mélange avec le fond.
    // On retire cette part pour éviter le liseré clair (ou sombre) au contour.
    if (a > 0 && a < 255) {
      const f = a / 255;
      for (let c = 0; c < 3; c++) {
        data[i * 4 + c] = Math.max(0, Math.min(255, Math.round((data[i * 4 + c] - bg[c] * (1 - f)) / f)));
      }
    }
  }

  mkdirSync(dirname(cible), { recursive: true });
  await sharp(data, { raw: { width, height, channels: 4 } }).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(cible);
  return { width, height, bg, partBord, ombresRetenues, trous, part: retires / n, octets: statSync(cible).size };
}

const args = process.argv.slice(2);
const outIdx = args.indexOf("--out");
const out = outIdx === -1 ? null : args[outIdx + 1];
const entrees = args.filter((a, i) => !a.startsWith("--") && i !== outIdx + 1);

if (!entrees.length) {
  console.error("usage : node scripts/remove-photo-background.mjs <fichier|dossier>... [--out <dossier>]");
  process.exit(2);
}

const fichiers = [];
for (const e of entrees) {
  if (!existsSync(e)) {
    console.error(`Introuvable : ${e}`);
    process.exit(2);
  }
  if (statSync(e).isDirectory()) for (const f of readdirSync(e).filter((f) => /\.(webp|png|jpe?g)$/i.test(f))) fichiers.push(join(e, f));
  else fichiers.push(e);
}

let ko = 0;
for (const f of fichiers.sort()) {
  const cible = out ? join(out, basename(f).replace(/\.[^.]+$/, ".webp")) : f;
  try {
    const r = await traiter(f, cible);
    // Un fond détecté sur moins de 10 % ou plus de 90 % de l'image, ou des
    // coins qui ne s'accordent pas, trahissent une photo au fond non uni.
    // Alertes : fond peu franc sur le pourtour, ou part retirée implausible.
    const suspect = r.part < 0.1 || r.part > 0.9 || r.partBord < 0.6;
    if (suspect) ko++;
    console.log(
      `${suspect ? "✘" : "✔"} ${basename(cible).padEnd(22)} ${String(r.width + "x" + r.height).padEnd(10)} fond rgb(${r.bg.join(",")}) sur ${(r.partBord * 100).toFixed(0)} % du pourtour · retiré ${(r.part * 100).toFixed(1)} %${r.ombresRetenues ? " (ombres incluses)" : " (masque strict)"} ${r.trous ? ` · ${r.trous} px rebouchés` : ""} · ${Math.round(r.octets / 1024)} Ko`,
    );
  } catch (e) {
    ko++;
    console.log(`✘ ${basename(f).padEnd(22)} ${String(e.message).slice(0, 100)}`);
  }
}
console.log(ko ? `\n${ko} image(s) à revoir` : `\n${fichiers.length} image(s) détourée(s)`);
process.exit(ko ? 1 : 0);
