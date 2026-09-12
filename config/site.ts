export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export const ROUTES = {
  home: "/",
  repair: "/reparation",
  howItWorks: "/comment-ca-marche",
  trust: "/confiance",
  faq: "/faq",
  tracking: "/suivi",
  packaging: "/emballage",
  contact: "/contact",
  cgv: "/cgv",
  privacy: "/confidentialite",
  legal: "/mentions-legales",
  login: "/connexion",
  register: "/inscription",
  forgotPassword: "/mot-de-passe-oublie",
  account: "/compte",
  accountOrders: "/compte/dossiers",
  accountProfile: "/compte/profil",
  accountAddresses: "/compte/adresses",
  checkout: "/commande",
  // Vestiges de la boutique. Le site ne vend plus rien : les pages publiques
  // correspondantes ont été supprimées. Ces quatre entrées ne servent plus qu'à
  // construire des URL dans le module de vente resté en place pour le
  // back-office (historique des commandes, mouvements de stock) et dans le
  // retour de paiement. Aucune commande boutique ne peut plus être créée.
  shopCheckout: "/commande-boutique",
  shopConfirmation: "/commande-boutique/confirmation",
  accountShopOrders: "/compte/commandes",
  accountTradeIns: "/compte/reprises",
  tradeIn: "/reprise",
  tradeInTracking: "/reprise/suivi",
  consoles: "/consoles",
  admin: "/admin",
} as const;

export const CHECKOUT_STEPS = [
  { key: "console", label: "Console" },
  { key: "model", label: "Modèle" },
  { key: "fault", label: "Panne" },
  { key: "repair", label: "Prestation" },
  { key: "options", label: "Options" },
  { key: "shipping", label: "Transport" },
  { key: "details", label: "Coordonnées" },
  { key: "payment", label: "Paiement" },
] as const;

export type CheckoutStepKey = (typeof CHECKOUT_STEPS)[number]["key"];

/** Upload limits enforced server side. */
export const UPLOAD_LIMITS = {
  imageMaxBytes: 15 * 1024 * 1024,
  videoMaxBytes: 100 * 1024 * 1024,
  documentMaxBytes: 20 * 1024 * 1024,
  allowedImageTypes: ["image/jpeg", "image/png", "image/webp", "image/heic"],
  allowedVideoTypes: ["video/mp4", "video/quicktime", "video/webm"],
  allowedDocumentTypes: ["application/pdf"],
} as const;
