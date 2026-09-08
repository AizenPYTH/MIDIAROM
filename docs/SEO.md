# SEO

- Pages programmatiques : `/reparation/[model]` (modèle actif) et `/reparation/[model]/[fault]` (réparation active **et** `is_seo_published`). Seules les combinaisons activées dans le back-office sont générées et listées dans `sitemap.xml`.
- Chaque page réparation : title, meta description, canonical, H1, symptômes, causes, procédure, prix, délai, garantie, transport, FAQ (JSON) et CTA — tous éditables dans Catalogue → Réparations.
- Données structurées : `LocalBusiness` (accueil), `Service` + `Offer` (pages réparation/modèle), `BreadcrumbList`, `FAQPage`.
- Pages statiques : title/description/no-index dans Contenu → Pages SEO (`seo_pages`).
- `robots.txt` exclut les zones privées ; `sitemap.xml` regénéré toutes les heures.
- Google Ads : faire pointer les annonces vers la page réparation exacte (ex. `/reparation/ps5/hdmi`), l'attribution UTM est conservée sur la commande.
