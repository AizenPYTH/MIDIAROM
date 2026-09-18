-- ============================================================================
-- Cinq problèmes par modèle, et une porte de sortie
-- ============================================================================
--
-- La migration précédente a ramené le catalogue de 1 189 prestations actives à
-- 194, soit neuf à quatorze par console. C'est un catalogue tenable pour
-- l'atelier ; ce n'est pas encore un écran tenable pour le client.
--
-- Quelqu'un dont la console vient de mourir ne parcourt pas quatorze
-- propositions : il cherche la sienne, ne la trouve pas exactement, hésite,
-- puis s'en va. On lui en montre donc **cinq** — les plus fréquentes pour son
-- modèle — et on lui laisse une porte : « Autre problème », où il décrit ce
-- qu'il constate et joint des photos.
--
-- Cette porte ne crée aucune prestation en base. C'est le point de la manœuvre :
-- couvrir les cas rares en allongeant la liste, c'est reconstruire le mur qu'on
-- vient d'abattre, une ligne à la fois. La couverture se fait par la
-- description, que le réparateur lit avant de chiffrer.
--
-- Cette migration **ne supprime rien et ne désactive rien**. Les neuf à
-- quatorze prestations actives par modèle restent actives : elles servent au
-- réparateur quand il compose un devis. Seule change la **vitrine** —
-- `is_featured`, c'est-à-dire ce que le client voit d'emblée.
--
-- Rejouable.
-- ============================================================================

with rangs as (
  select r.id,
         row_number() over (
           partition by r.model_id
           -- L'ordre existant fait foi : `is_featured` et `featured_order`
           -- portent les arbitrages déjà faits au back-office, qu'aucune
           -- migration ne doit balayer. `display_order` puis le nom ne servent
           -- qu'à départager, et à rendre le résultat identique à chaque
           -- exécution.
           order by r.is_featured desc, r.featured_order, r.display_order, r.name
         ) as rang
    from public.repairs r
   where r.is_active
)
update public.repairs r
   set is_featured = (rangs.rang <= 5),
       featured_order = case when rangs.rang <= 5 then rangs.rang else 0 end
  from rangs
 where rangs.id = r.id
   and (r.is_featured <> (rangs.rang <= 5)
        or r.featured_order <> case when rangs.rang <= 5 then rangs.rang else 0 end);

-- Une prestation inactive ne peut pas être en vitrine : elle laisserait un
-- trou dans la grille des cinq.
update public.repairs
   set is_featured = false, featured_order = 0
 where is_featured and not is_active;
