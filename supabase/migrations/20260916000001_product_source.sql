-- Provenance d'un produit importé depuis une source externe.
--
-- L'import de figurines part d'un catalogue tiers (HobbyLink Japan, demain
-- peut-être un autre). Deux choses doivent être tracées, et une seule ne suffit
-- pas :
--
--   1. **d'où vient la fiche** — pour la retrouver, la resynchroniser, et ne
--      pas réimporter deux fois la même référence ;
--   2. **à qui appartiennent les images** — les visuels d'un revendeur ne sont
--      pas ceux de MÉDI@ROM. Les publier tels quels sur une fiche de vente
--      serait s'approprier le travail d'un autre.
--
-- D'où la séparation : `images` reste la colonne des visuels dont le magasin
-- dispose — c'est elle que la boutique affiche —, et `external_images` garde
-- les visuels de la source avec leur URL d'origine, pour aider à la saisie sans
-- jamais se faire passer pour du contenu maison.
--
-- Le reste des informations d'une figurine (fabricant, licence, personnage,
-- série, dimensions, date de sortie) va dans `specs`, le jsonb déjà affiché sur
-- la fiche produit : pas besoin d'une colonne par attribut.

alter table public.products add column if not exists source text;
alter table public.products add column if not exists source_ref text;
alter table public.products add column if not exists source_url text;
alter table public.products add column if not exists external_images jsonb not null default '[]'::jsonb;

comment on column public.products.source is
  'Catalogue d''origine de la fiche : HLJ, MANUAL… null pour une saisie maison.';
comment on column public.products.source_ref is
  'Référence du produit chez la source. Unique par source : sert à ne pas réimporter deux fois.';
comment on column public.products.source_url is
  'Page d''origine, pour vérifier la fiche et créditer la source.';
comment on column public.products.external_images is
  'Visuels de la source : [{url, source, sourceUrl}]. NE PAS publier tels quels — MÉDI@ROM n''en détient pas les droits. Remplir `images` avec des visuels maison avant de mettre en ligne.';

-- Une même référence ne s'importe qu'une fois par source. Partiel : les
-- produits saisis à la main n'ont pas de référence externe.
create unique index if not exists products_source_ref_key
  on public.products (source, source_ref)
  where source is not null and source_ref is not null;
