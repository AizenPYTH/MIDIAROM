/**
 * Trouve par où la recherche de HobbyLink Japan passe réellement.
 *
 * Constat de départ : `GET /search/?Word=…` répond 200 avec 218 000 caractères
 * et **zéro** donnée structurée. La page est rendue par le navigateur — donc
 * elle appelle quelque chose pour obtenir ses résultats. Ce quelque chose est
 * un endpoint, et il est nommé dans la page ou dans ses bundles JavaScript.
 *
 * Ce module ne devine rien : il lit la page, suit ses scripts, et rapporte les
 * indices. C'est l'inverse de ce qui a échoué deux fois — on regarde avant
 * d'écrire du code.
 */

const MOTEURS = [
  { nom: "Algolia", motif: /algolia(net|\.com|search)/i },
  { nom: "Typesense", motif: /typesense/i },
  { nom: "Searchspring", motif: /searchspring/i },
  { nom: "Klevu", motif: /klevu/i },
  { nom: "Constructor.io", motif: /constructor\.io/i },
  { nom: "Bloomreach", motif: /bloomreach|brsm/i },
  { nom: "Elasticsearch", motif: /elasticsearch|elastic\.co/i },
  { nom: "Shopify", motif: /shopify|myshopify/i },
  { nom: "Magento", motif: /magento|graphql/i },
];

/** Toutes les URL plausibles d'API trouvées dans un texte. */
export function endpointsFrom(texte, base) {
  const trouves = new Set();
  const motifs = [
    /["'`](https?:\/\/[^"'`\s]*\/(?:api|search|graphql|query)[^"'`\s]*)["'`]/gi,
    /["'`](\/(?:api|search|graphql|query)\/[^"'`\s]*)["'`]/gi,
    /["'`](\/[a-z0-9_-]*\/?(?:api|ajax)\/[^"'`\s]*)["'`]/gi,
  ];
  for (const motif of motifs) {
    for (const m of texte.matchAll(motif)) {
      const brut = m[1];
      if (!brut || brut.length > 220) continue;
      // On écarte le bruit évident : images, styles, polices.
      if (/\.(png|jpe?g|gif|svg|webp|css|woff2?|ico)(\?|$)/i.test(brut)) continue;
      try {
        trouves.add(new URL(brut, base).toString());
      } catch {
        /* URL inexploitable */
      }
    }
  }
  return [...trouves];
}

/** Les blobs d'état que les frameworks laissent dans la page. */
export function stateBlobs(html) {
  const cles = ["__NEXT_DATA__", "__NUXT__", "__INITIAL_STATE__", "__APOLLO_STATE__", "__remixContext", "window.dataLayer"];
  return cles.filter((cle) => html.includes(cle));
}

/** Les moteurs de recherche tiers reconnus dans un texte. */
export function enginesIn(texte) {
  return MOTEURS.filter((m) => m.motif.test(texte)).map((m) => m.nom);
}

/** Les clés d'API visibles, masquées : on les signale sans les recopier. */
export function apiKeyHints(texte) {
  const hints = [];
  const patterns = [
    { nom: "Algolia appId", motif: /["'](?:appId|applicationId|X-Algolia-Application-Id)["']\s*:\s*["']([A-Z0-9]{8,})["']/gi },
    { nom: "Algolia searchKey", motif: /["'](?:apiKey|searchKey|X-Algolia-API-Key)["']\s*:\s*["']([a-f0-9]{16,})["']/gi },
    { nom: "clé générique", motif: /["'](?:publicKey|siteKey|accessToken)["']\s*:\s*["']([\w-]{12,})["']/gi },
  ];
  for (const { nom, motif } of patterns) {
    for (const m of texte.matchAll(motif)) {
      const v = m[1];
      if (v) hints.push(`${nom} : ${v.slice(0, 4)}…${v.slice(-3)} (${v.length} caractères)`);
    }
  }
  return [...new Set(hints)];
}

/** Les `<script src>` d'une page, en absolu. */
export function scriptUrls(html, base) {
  const urls = [];
  for (const m of html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)) {
    try {
      urls.push(new URL(m[1], base).toString());
    } catch {
      /* ignoré */
    }
  }
  return [...new Set(urls)];
}

/** Le formulaire de recherche : son action et le nom de son champ. */
export function searchForm(html) {
  const form = html.match(/<form[^>]*(?:id|class|action)=["'][^"']*search[^"']*["'][^>]*>[\s\S]{0,1200}?<\/form>/i)?.[0];
  if (!form) return null;
  return {
    action: form.match(/action=["']([^"']+)["']/i)?.[1] ?? null,
    champs: [...form.matchAll(/<input[^>]+name=["']([^"']+)["']/gi)].map((m) => m[1]),
  };
}
