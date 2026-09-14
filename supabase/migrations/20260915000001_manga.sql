-- Catégorie « Manga & Anime ».
--
-- La boutique est orientée gaming et pop culture : jeux, consoles, figurines,
-- manga/anime. Les trois premières existaient déjà dans `product_category` ;
-- le manga n'avait nulle part où aller et se serait retrouvé confondu avec les
-- collectors. On lui donne sa propre valeur.
--
-- Idempotent, et sans usage de la nouvelle valeur dans cette même migration :
-- PostgreSQL interdit de s'en servir dans la transaction qui la crée.
alter type public.product_category add value if not exists 'MANGA';
