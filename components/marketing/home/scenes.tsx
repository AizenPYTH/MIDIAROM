import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { CONSOLE_PHOTOS, STOREFRONT } from "@/lib/content/assets";

/**
 * Scènes de l'accueil rendues côté serveur.
 *
 * Aucune de ces sections n'a besoin de JavaScript : le récit de réparation, la
 * bascule vers la boutique et les révélations sont chorégraphiés par
 * `animation-timeline` dans app/globals.css, sur des scènes `position: sticky`.
 * Sans prise en charge du navigateur, le repli `@supports not` les remet en
 * flux vertical — tout reste lisible.
 */

const LIME = "#d8ff3e";
const CYAN = "#33e1ff";
const VIOLET = "#7c5cff";
const ROSE = "#ff5ca8";

/** Le hero de la réparation : trois lignes, une accroche, deux actions. */
export function HeroRepair() {
  return (
    <section id="top" data-hero="1" style={{ position: "relative", minHeight: "100svh", padding: "132px 30px 60px", display: "flex", alignItems: "center", overflow: "hidden" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "-10%", pointerEvents: "none", zIndex: 0 }}>
        <div data-depth="0.06" className="anim-drift1" style={{ position: "absolute", top: "6%", left: "-6%", width: 640, height: 640, borderRadius: 999, background: "radial-gradient(circle, #7c5cff 0%, rgba(124,92,255,0) 68%)", filter: "blur(50px)", opacity: 0.5 }} />
        <div data-depth="0.04" className="anim-drift2" style={{ position: "absolute", bottom: "-12%", right: "-8%", width: 560, height: 560, borderRadius: 999, background: "radial-gradient(circle, #33e1ff 0%, rgba(51,225,255,0) 66%)", filter: "blur(54px)", opacity: 0.32 }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 52, alignItems: "center" }}>
        <div data-hero-copy="1" style={{ minWidth: 0 }}>
          <span data-hero-badge="1" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#b9b4e8", border: "1px solid rgba(244,242,255,0.14)", borderRadius: 999, padding: "9px 16px" }}>
            <span className="anim-pulse" style={{ width: 8, height: 8, borderRadius: 999, background: LIME }} />
            Atelier ouvert · Marseille · depuis 1997
          </span>
          <h1 style={{ margin: "26px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(44px,7.4vw,116px)", lineHeight: 0.86, letterSpacing: "-0.05em" }}>
            <span style={{ display: "block" }}>On ouvre.</span>
            <span style={{ display: "block" }}>On répare.</span>
            <span style={{ display: "block" }}>
              On <span className="shimmer-text">referme</span>.
            </span>
          </h1>
          <p data-hero-sub="1" style={{ margin: "24px 0 0", maxWidth: "38ch", fontSize: "clamp(16px,1.6vw,20px)", lineHeight: 1.45, color: "#b9b4e8" }}>
            Consoles, manettes, smartphones, PC. Diagnostic sous 48 heures, devis avant toute intervention, garantie trois mois.
          </p>
          <div data-hero-cta="1" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
            <Link href={ROUTES.repair} className="btn-gradient" style={{ borderRadius: 999, padding: "19px 32px", fontWeight: 600, fontSize: 17, color: "var(--color-on-accent)", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Démarrer mon devis
            </Link>
            <a href="#boutique" style={{ borderRadius: 999, padding: "19px 30px", border: "1px solid rgba(244,242,255,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f4f2ff", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Voir la boutique
            </a>
          </div>
          <div data-hero-stats="1" style={{ display: "flex", gap: 34, flexWrap: "wrap", marginTop: 40 }}>
            {[
              { value: "48 h", label: "Diagnostic", color: LIME },
              { value: "3 mois", label: "Garantie", color: CYAN },
              { value: "1997", label: "Depuis", color: VIOLET },
            ].map((stat) => (
              <span key={stat.label} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(28px,3.4vw,44px)", letterSpacing: "-0.035em", color: stat.color }}>{stat.value}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a95c4" }}>{stat.label}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Visuel du hero : le détouré de console est sur fond blanc, il lui
            faut donc son propre cadre clair. C'est la seule photo d'appareil
            dont on dispose ; une vraie photo d'atelier la remplacera. */}
        <div data-hero-visual="1" style={{ position: "relative", minWidth: 0 }}>
          <div data-depth="0.03" style={{ position: "relative", aspectRatio: "4/3", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(244,242,255,0.12)", boxShadow: "0 40px 120px rgba(0,0,0,0.55)", background: "radial-gradient(120% 120% at 50% 35%, #f7f6fb, #cfcbe2)" }}>
            <Image src={CONSOLE_PHOTOS["ps4"]!} alt="PlayStation 4 prise en charge à l'atelier" fill sizes="(max-width: 900px) 92vw, 620px" priority style={{ objectFit: "contain", padding: 32 }} />
          </div>
          <span data-depth="0.16" className="glass" style={{ position: "absolute", left: -12, bottom: 34, display: "flex", flexDirection: "column", gap: 3, borderRadius: 18, padding: "13px 17px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>En cours</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>Reflow port HDMI</span>
          </span>
          <span data-depth="0.22" className="glass" style={{ position: "absolute", right: -10, top: 28, display: "flex", flexDirection: "column", gap: 3, borderRadius: 18, padding: "13px 17px" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.03em", color: LIME }}>48 h</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>Devis</span>
          </span>
        </div>
      </div>
    </section>
  );
}

const BEATS = [
  { n: "01", title: "Elle arrive ouverte", body: "Colis prépayé ou dépôt au comptoir. On enregistre, on photographie, on vous envoie le numéro de suivi.", meta: "Jour 1", color: CYAN },
  { n: "02", title: "On cherche la panne", body: "Banc de test, mesures, relecture de ce que vous avez décrit. Le diagnostic est offert si la réparation est acceptée.", meta: "Sous 48 heures", color: LIME },
  { n: "03", title: "Vous validez, ou non", body: "Devis détaillé, pièce par pièce. Refus du devis : la console repart, seul le port reste dû.", meta: "Un clic", color: ROSE },
  { n: "04", title: "Elle repart testée", body: "Deux heures sous charge avant expédition. Garantie trois mois sur l'intervention et la pièce.", meta: "Jour 5", color: LIME },
];

/**
 * Le récit de l'atelier, en quatre temps.
 *
 * La scène fait 420svh ; l'étage est `sticky`. Chaque temps occupe un quart de
 * la chronologie `--story` (voir globals.css) : le texte se relaie, la jauge se
 * remplit, le volet « avant / après » se découvre. Sans chronologie, les quatre
 * temps s'empilent verticalement.
 */
export function StoryScene() {
  return (
    <section id="atelier" data-story="1" style={{ position: "relative", background: "#07060a", height: "420svh" }}>
      <div data-story-stage="1" style={{ position: "sticky", top: 0, height: "100svh", display: "flex", alignItems: "center", padding: "100px 30px", overflow: "hidden" }}>
        <div style={{ width: "100%", maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 52, alignItems: "center" }}>
          <div style={{ position: "relative", minWidth: 0, order: 2 }}>
            <div style={{ position: "relative", aspectRatio: "5/4", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(244,242,255,0.12)", boxShadow: "0 40px 120px rgba(0,0,0,0.55)" }}>
              {/* Volet « avant / après ». Les deux photos du banc restent à
                  fournir (voir MISSING_ASSETS) : en attendant, la face
                  découverte montre la vraie devanture — la console repart
                  d'ici — et la face initiale garde l'aplat de la charte. */}
              <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 30% 20%, rgba(124,92,255,0.35), #0b0910 70%)" }} />
              <div data-story-wipe="1" style={{ position: "absolute", inset: 0, clipPath: "inset(0 100% 0 0)" }}>
                <Image src={STOREFRONT} alt="La devanture du 207 rue de Rome, à Marseille" fill sizes="(max-width: 900px) 92vw, 620px" style={{ objectFit: "cover" }} />
              </div>
              <span data-story-seam="1" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 2, background: "linear-gradient(180deg,transparent,#d8ff3e,transparent)", boxShadow: "0 0 22px rgba(216,255,62,0.7)" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
              {BEATS.map((beat) => (
                <span key={beat.n} data-beat-rail="1" style={{ flex: 1, height: 3, borderRadius: 999, background: "rgba(244,242,255,0.12)", overflow: "hidden" }}>
                  <span data-beat-fill="1" style={{ display: "block", height: 3, width: "100%", background: LIME, transform: "scaleX(0)", transformOrigin: "left" }} />
                </span>
              ))}
            </div>
          </div>

          <div style={{ position: "relative", minWidth: 0, order: 1 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>
              L&apos;atelier, étape par étape
            </span>
            <div data-beat-box="1" style={{ position: "relative", marginTop: 18, minHeight: 280 }}>
              {BEATS.map((beat) => (
                <div key={beat.n} data-beat="1" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.14em", color: beat.color }}>{beat.n}</span>
                  <strong style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,4.4vw,58px)", lineHeight: 0.94, letterSpacing: "-0.04em" }}>{beat.title}</strong>
                  <span style={{ fontSize: "clamp(15.5px,1.5vw,18px)", lineHeight: 1.45, color: "#b9b4e8", maxWidth: "34ch" }}>{beat.body}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.1em", textTransform: "uppercase", color: beat.color }}>{beat.meta}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SHIFT_WORDS = ["JEUX", "CONSOLES", "FIGURINES", "MANGA", "ANIME"];

/**
 * La bascule : le récit de réparation se referme, le rayon s'ouvre.
 *
 * Un voile circulaire s'élargit depuis le centre pendant que le premier texte
 * s'efface et que le second grandit. Tout est dans `--shift` ; sans
 * chronologie, seul le second texte est masqué et la section reste une simple
 * transition typographique.
 */
export function ShiftScene() {
  return (
    <section data-shift="1" style={{ position: "relative", background: "#07060a", height: "250svh" }}>
      <div data-shift-stage="1" style={{ position: "sticky", top: 0, height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "60px 30px" }}>
        <div data-shift-veil="1" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, clipPath: "circle(0% at 50% 50%)", background: "radial-gradient(circle at 50% 45%, #2b1024 0%, #150a13 46%, #0d0710 100%)" }} />

        <div data-shift-out="1" style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "24ch" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>Elle repart réparée</span>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,5vw,72px)", lineHeight: 0.92, letterSpacing: "-0.045em" }}>
            Et maintenant, on y joue.
          </p>
        </div>

        <div data-shift-in="1" style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 22, padding: "60px 30px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffb38a" }}>Boutique · Gaming &amp; Culture</span>
          <p style={{ margin: 0, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(38px,9vw,150px)", lineHeight: 0.82, letterSpacing: "-0.055em", color: "#fff4ea" }}>
            Le rayon
            <br />
            vous attend.
          </p>
        </div>

        <div data-shift-marquee="1" aria-hidden="true" style={{ position: "absolute", zIndex: 1, left: 0, right: 0, top: "50%", transform: "translateY(-50%)", overflow: "hidden", opacity: 0.14, pointerEvents: "none" }}>
          <div className="anim-marquee" style={{ display: "flex", width: "max-content" }}>
            {[...SHIFT_WORDS, ...SHIFT_WORDS].map((word, i) => (
              <span key={`${word}-${i}`} style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(60px,12vw,180px)", letterSpacing: "-0.05em", padding: "0 34px", whiteSpace: "nowrap", color: "#ff7a3d" }}>
                {word}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const SHOP_TAGS = ["Jeux vidéo", "Consoles", "Figurines", "Manga", "Anime", "Rétrogaming", "Accessoires", "Collector"];

/** L'entrée dans la boutique : ce que le magasin de la rue de Rome tient en rayon. */
export function ShopIntro() {
  return (
    <section id="boutique" data-warm="1" style={{ position: "relative", background: "#0d0710", padding: "110px 30px 0" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div className="anim-drift2" style={{ position: "absolute", top: "-8%", right: "-10%", width: 620, height: 620, borderRadius: 999, background: "radial-gradient(circle, #ff7a3d 0%, rgba(255,122,61,0) 68%)", filter: "blur(60px)", opacity: 0.3 }} />
        <div className="anim-drift1" style={{ position: "absolute", top: "40%", left: "-12%", width: 520, height: 520, borderRadius: 999, background: "radial-gradient(circle, #ff5ca8 0%, rgba(255,92,168,0) 66%)", filter: "blur(58px)", opacity: 0.22 }} />
      </div>

      <div style={{ position: "relative", maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px,1fr))", gap: 48, alignItems: "end" }}>
        <div data-reveal="1" style={{ minWidth: 0 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "#ffb38a" }}>207 rue de Rome · le magasin</span>
          <h2 style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(34px,5.6vw,86px)", lineHeight: 0.88, letterSpacing: "-0.045em", color: "#fff4ea" }}>
            Jeux, consoles,
            <br />
            figurines, manga.
          </h2>
          <p style={{ margin: "22px 0 0", fontSize: "clamp(16px,1.6vw,20px)", lineHeight: 1.42, maxWidth: "36ch", color: "#e4c9bd" }}>
            Trente ans de rayons. Le neuf, l&apos;occasion testée, le collector qu&apos;on ne trouve nulle part ailleurs.
          </p>
        </div>
        <div data-reveal="1" style={{ position: "relative", minWidth: 0, aspectRatio: "4/5", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(255,244,234,0.16)", boxShadow: "0 40px 120px rgba(0,0,0,0.6)" }}>
          <Image src={STOREFRONT} alt="La vitrine du 207 Médi@roM : jeux, consoles et figurines" fill sizes="(max-width: 900px) 92vw, 520px" style={{ objectFit: "cover" }} />
          <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(13,7,16,0) 45%, rgba(13,7,16,0.85) 100%)" }} />
          <span style={{ position: "absolute", left: 20, bottom: 18, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#fff4ea" }}>
            207 rue de Rome · Marseille 6ᵉ
          </span>
        </div>
        <div data-reveal="1" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "flex-start", alignContent: "flex-start" }}>
          {SHOP_TAGS.map((tag) => (
            <Link
              key={tag}
              href={ROUTES.shop}
              // Devenue cliquable, la pastille doit tenir la cible tactile de 44 px.
              style={{ display: "inline-flex", alignItems: "center", minHeight: 44, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", border: "1px solid rgba(255,244,234,0.22)", borderRadius: 999, padding: "12px 17px", color: "#fff4ea", whiteSpace: "nowrap" }}
            >
              {tag}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
