import Link from "next/link";
import Image from "next/image";
import { ROUTES } from "@/config/site";
import { HERO_PHOTO, STORY_AFTER, STORY_BEFORE } from "@/lib/content/assets";

/**
 * Le récit de réparation, en deux sections seulement.
 *
 * Il en comptait quatre, dont une scène épinglée de 420svh qui relayait quatre
 * textes les uns après les autres. On scrollait beaucoup pour peu de contenu.
 * Les quatre temps sont désormais lisibles d'un coup d'œil, et la seule
 * animation conservée ici est celle qui dit quelque chose : le volet avant /
 * après, qui montre le métier.
 *
 * Aucune de ces sections n'a besoin de JavaScript.
 */

const LIME = "#d8ff3e";
const CYAN = "#33e1ff";
const VIOLET = "#7c5cff";

/** Le hero : ce que fait l'atelier, en trois mots et deux actions. */
export function HeroRepair() {
  return (
    <section id="top" style={{ position: "relative", minHeight: "100svh", padding: "132px 30px 60px", display: "flex", alignItems: "center", overflow: "hidden" }}>
      {/* Deux halos très diffus, en boucle lente. Ils ne réagissent pas au
          défilement : c'est une ambiance, pas une animation de plus. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: "-10%", pointerEvents: "none", zIndex: 0 }}>
        <div className="anim-drift1" style={{ position: "absolute", top: "6%", left: "-6%", width: 640, height: 640, borderRadius: 999, background: "radial-gradient(circle, #7c5cff 0%, rgba(124,92,255,0) 68%)", filter: "blur(50px)", opacity: 0.45 }} />
        <div className="anim-drift2" style={{ position: "absolute", bottom: "-12%", right: "-8%", width: 560, height: 560, borderRadius: 999, background: "radial-gradient(circle, #33e1ff 0%, rgba(51,225,255,0) 66%)", filter: "blur(54px)", opacity: 0.28 }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 52, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#b9b4e8", border: "1px solid rgba(244,242,255,0.14)", borderRadius: 999, padding: "9px 16px" }}>
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
          <p style={{ margin: "24px 0 0", maxWidth: "38ch", fontSize: "clamp(16px,1.6vw,20px)", lineHeight: 1.45, color: "#b9b4e8" }}>
            PlayStation, Xbox, Nintendo Switch, manettes, rétro. Diagnostic sous 48 heures, devis avant toute intervention, garantie trois mois.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 30 }}>
            <Link href={ROUTES.repair} className="btn-gradient" style={{ borderRadius: 999, padding: "19px 32px", fontWeight: 600, fontSize: 17, color: "var(--color-on-accent)", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Démarrer mon devis
            </Link>
            <a href="#boutique" style={{ borderRadius: 999, padding: "19px 30px", border: "1px solid rgba(244,242,255,0.2)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: "#f4f2ff", minHeight: 52, display: "inline-flex", alignItems: "center" }}>
              Voir la boutique
            </a>
          </div>
          <div style={{ display: "flex", gap: 34, flexWrap: "wrap", marginTop: 40 }}>
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

        {/* Emplacement du visuel principal : renseigner HERO_PHOTO suffit à le
            remplir. En attendant, l'aplat de la charte, jamais un cadre vide. */}
        <div style={{ position: "relative", minWidth: 0 }}>
          <div style={{ position: "relative", aspectRatio: "4/3", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(244,242,255,0.12)", boxShadow: "0 40px 120px rgba(0,0,0,0.55)", background: HERO_PHOTO ? "radial-gradient(120% 120% at 50% 35%, #f7f6fb, #cfcbe2)" : "radial-gradient(130% 120% at 65% 25%, rgba(124,92,255,0.42), rgba(51,225,255,0.18) 46%, rgba(13,7,16,0.9) 78%)" }}>
            {HERO_PHOTO ? (
              <Image src={HERO_PHOTO} alt="" fill sizes="(max-width: 900px) 92vw, 620px" priority style={{ objectFit: "contain", padding: 32 }} />
            ) : (
              <span aria-hidden="true" className="anim-drift1" style={{ position: "absolute", inset: "-20%", background: "radial-gradient(circle at 40% 60%, rgba(216,255,62,0.22), transparent 62%)", filter: "blur(30px)" }} />
            )}
          </div>
          <span className="glass" style={{ position: "absolute", left: -12, bottom: 34, display: "flex", flexDirection: "column", gap: 3, borderRadius: 18, padding: "13px 17px" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>En cours</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.02em" }}>Reflow port HDMI</span>
          </span>
          <span className="glass" style={{ position: "absolute", right: -10, top: 28, display: "flex", flexDirection: "column", gap: 3, borderRadius: 18, padding: "13px 17px" }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 19, letterSpacing: "-0.03em", color: LIME }}>48 h</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>Devis</span>
          </span>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "Elle arrive", body: "Colis prépayé ou dépôt au comptoir. On enregistre, on photographie, vous recevez le numéro de suivi.", meta: "Jour 1" },
  { n: "02", title: "On cherche la panne", body: "Banc de test et mesures. Le diagnostic est offert si la réparation est acceptée.", meta: "Sous 48 heures" },
  { n: "03", title: "Vous validez, ou non", body: "Devis détaillé, pièce par pièce. En cas de refus, la console repart : seul le port reste dû.", meta: "Un clic" },
  { n: "04", title: "Elle repart testée", body: "Deux heures sous charge avant expédition. Garantie trois mois sur l'intervention et la pièce.", meta: "Jour 5" },
];

/**
 * L'atelier en quatre temps, plus le volet avant / après.
 *
 * Les quatre temps sont posés côte à côte et lisibles immédiatement : plus
 * besoin de traverser 420svh pour les voir défiler un par un. La seule
 * animation est le balayage du volet, déclenché à l'entrée de la section —
 * c'est le geste du métier, il mérite son mouvement.
 */
export function RepairFlow() {
  return (
    <section id="atelier" style={{ position: "relative", background: "#07060a", padding: "110px 30px" }}>
      <div style={{ maxWidth: 1420, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px,1fr))", gap: 56, alignItems: "center" }}>
        <div style={{ minWidth: 0 }}>
          <span data-reveal="1" style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>
            L&apos;atelier, étape par étape
          </span>
          <h2 data-reveal="1" style={{ margin: "16px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(32px,4.8vw,64px)", lineHeight: 0.92, letterSpacing: "-0.045em" }}>
            Quatre étapes, aucune surprise.
          </h2>
          <ol style={{ listStyle: "none", margin: "38px 0 0", padding: 0, display: "grid", gap: 26 }}>
            {STEPS.map((step) => (
              <li key={step.n} data-reveal="1" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "start" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, letterSpacing: "0.14em", color: LIME, paddingTop: 4 }}>{step.n}</span>
                <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                  <strong style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(19px,2.1vw,25px)", letterSpacing: "-0.03em" }}>{step.title}</strong>
                  <span style={{ fontSize: 15.5, lineHeight: 1.45, color: "#b9b4e8", maxWidth: "42ch" }}>{step.body}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9a95c4" }}>{step.meta}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* Volet avant / après. Les deux photos viendront du magasin :
            renseigner STORY_BEFORE et STORY_AFTER suffit. Le balayage
            fonctionne sur les aplats en attendant. */}
        <div data-reveal="1" style={{ position: "relative", minWidth: 0 }}>
          <div style={{ position: "relative", aspectRatio: "5/4", borderRadius: 28, overflow: "hidden", border: "1px solid rgba(244,242,255,0.12)", boxShadow: "0 40px 120px rgba(0,0,0,0.55)" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(120% 100% at 30% 20%, rgba(124,92,255,0.38), #0b0910 70%)" }}>
              {STORY_BEFORE ? <Image src={STORY_BEFORE} alt="" fill sizes="(max-width: 900px) 92vw, 620px" style={{ objectFit: "cover" }} /> : null}
            </div>
            <div data-repair-wipe="1" style={{ position: "absolute", inset: 0, clipPath: "inset(0 100% 0 0)", background: "radial-gradient(120% 100% at 70% 30%, rgba(216,255,62,0.30), #0b0910 68%)" }}>
              {STORY_AFTER ? <Image src={STORY_AFTER} alt="" fill sizes="(max-width: 900px) 92vw, 620px" style={{ objectFit: "cover" }} /> : null}
            </div>
          </div>
          <span style={{ display: "flex", justifyContent: "space-between", marginTop: 14, fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#9a95c4" }}>
            <span>Avant</span>
            <span style={{ color: LIME }}>Après</span>
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * La bascule atelier → boutique. **La seule scène épinglée de la page.**
 *
 * Un voile circulaire s'ouvre, le texte d'atelier s'efface, celui de la
 * boutique prend sa place. C'est le moment fort, et il est unique : 180svh au
 * lieu de 250, sans le bandeau de mots géants qui tournait derrière sans rien
 * ajouter. Sans chronologie de défilement, la section reste une simple
 * transition typographique.
 */
export function ShiftScene() {
  return (
    <section data-shift="1" style={{ position: "relative", background: "#07060a", height: "180svh" }}>
      <div data-shift-stage="1" style={{ position: "sticky", top: 0, height: "100svh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", padding: "60px 30px" }}>
        <div data-shift-veil="1" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 0, clipPath: "circle(0% at 50% 45%)", background: "radial-gradient(circle at 50% 45%, #2b1024 0%, #150a13 46%, #0d0710 100%)" }} />

        <div data-shift-out="1" style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "24ch" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "#9a95c4" }}>Elle repart réparée</span>
          <p style={{ margin: "14px 0 0", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(30px,5vw,72px)", lineHeight: 0.92, letterSpacing: "-0.045em" }}>
            Et maintenant, on y joue.
          </p>
        </div>

        <div data-shift-in="1" style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "60px 30px" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "#ffb38a" }}>La boutique</span>
          <p style={{ margin: 0, textAlign: "center", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(38px,8vw,132px)", lineHeight: 0.84, letterSpacing: "-0.055em", color: "#fff4ea" }}>
            Jeux, consoles,
            <br />
            figurines, manga.
          </p>
        </div>
      </div>
    </section>
  );
}
