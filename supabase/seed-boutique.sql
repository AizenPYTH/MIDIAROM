-- ---------------------------------------------------------------------------
-- Premier rayon en ligne : 10 jeux vidéo, 10 consoles, 10 figurines.
--
-- À QUOI SERT CE FICHIER
--
-- Le catalogue de vente est saisi à la main au back-office
-- (`/admin/annonces/nouvelle`). Tant qu'aucun article n'y est entré, la
-- boutique et le mur de produits de l'accueil affichent leur état vide — ce
-- qui est correct, mais ne montre rien. Ce fichier pose un rayon de départ
-- complet, cohérent avec les trois catégories de la page d'accueil, pour que
-- le magasin ait quelque chose à corriger plutôt qu'une page blanche à
-- remplir.
--
-- CE QUI DOIT ÊTRE RELU AVANT DE VENDRE
--
--   * les PRIX sont des ordres de grandeur du marché français, pas les prix
--     commerciaux du magasin. Aucun ne vient du cahier des charges ;
--   * les QUANTITÉS sont arbitraires : personne n'a compté le stock réel ;
--   * l'ÉTAT (neuf / révisé / occasion A-B-C) doit correspondre à l'exemplaire
--     réellement en rayon ;
--   * les PHOTOS sont volontairement absentes (`images` vide). Une photo
--     empruntée ailleurs ne serait pas celle de l'article vendu. En attendant,
--     la carte affiche une vignette typographique, et le magasin dépose ses
--     propres photos depuis la fiche produit.
--
-- Tout cela se corrige dans `/admin/stock`, sans repasser par ce fichier.
--
-- COMMENT L'APPLIQUER
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed-boutique.sql
--
-- ou en collant son contenu dans le SQL Editor de Supabase.
--
-- Rejouable sans risque : chaque ligne est identifiée par son `slug`, et une
-- seconde exécution met simplement la fiche à jour au lieu de la dupliquer.
-- Elle ne touche à aucune autre table, ne supprime rien, et n'écrase pas les
-- photos déjà déposées (`images` n'est mis à jour que s'il est encore vide).
-- ---------------------------------------------------------------------------

insert into public.products
  (sku, slug, name, category, platform, condition, condition_notes, description,
   price_cents, compare_at_price_cents, quantity, low_stock_threshold,
   is_retro, is_featured, is_active, display_order)
values
  -- ── Jeux vidéo ───────────────────────────────────────────────────────────
  ('JEU-0001-EASPOR', 'ea-sports-fc-26-ps5', 'EA Sports FC 26', 'GAME', 'PlayStation 5', 'NEW', null,
   'Édition standard PlayStation 5, neuve et sous blister.',
   5999, null, 6, 2, false, true, true, 10),
  ('JEU-0002-MARIOK', 'mario-kart-world-switch-2', 'Mario Kart World', 'GAME', 'Nintendo Switch 2', 'NEW', null,
   'Édition standard Nintendo Switch 2, neuve et sous blister.',
   7999, null, 4, 2, false, true, true, 11),
  ('JEU-0003-THELEG', 'zelda-tears-of-the-kingdom-switch', 'The Legend of Zelda: Tears of the Kingdom', 'GAME', 'Nintendo Switch', 'USED_A', 'Boîtier et notice complets, cartouche sans rayure.',
   'Occasion testée en atelier : la cartouche est lancée et vérifiée avant la mise en rayon.',
   4499, 5999, 3, 2, false, false, true, 12),
  ('JEU-0004-ELDENR', 'elden-ring-ps5', 'Elden Ring', 'GAME', 'PlayStation 5', 'USED_A', 'Disque sans rayure, jaquette complète.',
   'Occasion testée en atelier : le disque est lu et vérifié avant la mise en rayon.',
   2999, 3999, 4, 2, false, false, true, 13),
  ('JEU-0005-GODOFW', 'god-of-war-ragnarok-ps5', 'God of War Ragnarök', 'GAME', 'PlayStation 5', 'USED_B', 'Micro-rayures sur le disque, lecture vérifiée. Jaquette légèrement marquée.',
   'Occasion testée en atelier : le disque est lu et vérifié avant la mise en rayon.',
   2499, 3499, 2, 2, false, false, true, 14),
  ('JEU-0006-HOGWAR', 'hogwarts-legacy-xbox-series-x', 'Hogwarts Legacy', 'GAME', 'Xbox Series X', 'USED_A', 'Disque sans rayure, jaquette complète.',
   'Occasion testée en atelier : le disque est lu et vérifié avant la mise en rayon.',
   2799, 3999, 3, 2, false, false, true, 15),
  ('JEU-0007-SUPERM', 'super-mario-odyssey-switch', 'Super Mario Odyssey', 'GAME', 'Nintendo Switch', 'USED_A', 'Boîtier complet, cartouche sans rayure.',
   'Occasion testée en atelier : la cartouche est lancée et vérifiée avant la mise en rayon.',
   3999, 4999, 5, 2, false, false, true, 16),
  ('JEU-0008-FORZAH', 'forza-horizon-5-xbox-series-x', 'Forza Horizon 5', 'GAME', 'Xbox Series X', 'NEW', null,
   'Édition standard Xbox Series X|S, neuve et sous blister.',
   3499, null, 4, 2, false, false, true, 17),
  ('JEU-0009-FINALF', 'final-fantasy-vii-rebirth-ps5', 'Final Fantasy VII Rebirth', 'GAME', 'PlayStation 5', 'USED_A', 'Deux disques, boîtier et jaquette complets.',
   'Occasion testée en atelier : les disques sont lus et vérifiés avant la mise en rayon.',
   3999, 4999, 2, 2, false, false, true, 18),
  ('JEU-0010-POKEMO', 'pokemon-ecarlate-switch', 'Pokémon Écarlate', 'GAME', 'Nintendo Switch', 'USED_B', 'Boîtier marqué, cartouche testée.',
   'Occasion testée en atelier : la cartouche est lancée et vérifiée avant la mise en rayon.',
   3499, 4499, 3, 2, false, false, true, 19),

  -- ── Consoles ─────────────────────────────────────────────────────────────
  ('CON-0001-PLAYST', 'playstation-5-slim-edition-disque', 'PlayStation 5 Slim — édition disque', 'CONSOLE', 'PlayStation 5', 'NEW', null,
   'Console neuve, lecteur de disque, une manette DualSense et les câbles d''origine.',
   54999, null, 3, 1, false, true, true, 20),
  ('CON-0002-PLAYST', 'playstation-5-edition-numerique-revisee', 'PlayStation 5 — édition numérique, révisée', 'CONSOLE', 'PlayStation 5', 'REFURBISHED', 'Révisée en atelier : nettoyage complet, pâte thermique refaite, ventilation contrôlée.',
   'Console d''occasion passée à l''atelier avant la mise en rayon, avec une manette et les câbles.',
   37999, 44999, 2, 1, false, true, true, 21),
  ('CON-0003-XBOXSE', 'xbox-series-x-1-to', 'Xbox Series X 1 To', 'CONSOLE', 'Xbox Series X', 'NEW', null,
   'Console neuve, une manette sans fil et les câbles d''origine.',
   49999, null, 2, 1, false, false, true, 22),
  ('CON-0004-XBOXSE', 'xbox-series-s-512-go', 'Xbox Series S 512 Go', 'CONSOLE', 'Xbox Series S', 'USED_A', 'Coque sans marque visible, manette testée.',
   'Occasion testée en atelier : lecture, ventilation et sortie vidéo vérifiées.',
   22999, 27999, 3, 1, false, false, true, 23),
  ('CON-0005-NINTEN', 'nintendo-switch-oled', 'Nintendo Switch OLED', 'CONSOLE', 'Nintendo Switch', 'NEW', null,
   'Console neuve, écran OLED 7 pouces, paire de Joy-Con et station d''accueil.',
   34999, null, 3, 1, false, true, true, 24),
  ('CON-0006-NINTEN', 'nintendo-switch-2019-revisee', 'Nintendo Switch (modèle 2019) — révisée', 'CONSOLE', 'Nintendo Switch', 'REFURBISHED', 'Révisée en atelier : batterie contrôlée, Joy-Con recalibrés, nettoyage complet.',
   'Console d''occasion passée à l''atelier avant la mise en rayon, avec ses Joy-Con et sa station.',
   19999, 24999, 4, 1, false, false, true, 25),
  ('CON-0007-STEAMD', 'steam-deck-oled-512-go', 'Steam Deck OLED 512 Go', 'CONSOLE', 'Steam Deck', 'USED_A', 'Écran sans rayure, housse d''origine fournie.',
   'Occasion testée en atelier : écran, gâchettes et autonomie vérifiés.',
   44999, 54999, 1, 1, false, false, true, 26),
  ('CON-0008-PLAYST', 'playstation-4-pro-1-to-revisee', 'PlayStation 4 Pro 1 To — révisée', 'CONSOLE', 'PlayStation 4', 'REFURBISHED', 'Révisée en atelier : nettoyage, pâte thermique refaite, lecteur contrôlé.',
   'Console d''occasion passée à l''atelier avant la mise en rayon, avec une manette et les câbles.',
   17999, 22999, 3, 1, false, false, true, 27),
  ('CON-0009-NINTEN', 'nintendo-64-revisee', 'Nintendo 64 — révisée', 'CONSOLE', 'Nintendo 64', 'REFURBISHED', 'Révisée en atelier : nettoyage des contacts, condensateurs contrôlés, sortie vidéo testée.',
   'Console rétro remise en état à l''atelier, livrée avec une manette et son alimentation.',
   14999, null, 2, 1, true, false, true, 28),
  ('CON-0010-SUPERN', 'super-nintendo-revisee', 'Super Nintendo — révisée', 'CONSOLE', 'Super Nintendo', 'REFURBISHED', 'Révisée en atelier : nettoyage des contacts, condensateurs contrôlés, sortie vidéo testée.',
   'Console rétro remise en état à l''atelier, livrée avec une manette et son alimentation.',
   13999, null, 2, 1, true, false, true, 29),

  -- ── Figurines manga / anime ──────────────────────────────────────────────
  ('FIG-0001-MONKEY', 'figurine-monkey-d-luffy-gear-5', 'Monkey D. Luffy — Gear 5', 'COLLECTIBLE', 'One Piece', 'NEW', null,
   'Figurine de collection One Piece, neuve et sous blister. Vendue en magasin et en ligne.',
   8999, null, 3, 1, false, true, true, 30),
  ('FIG-0002-RORONO', 'figurine-roronoa-zoro', 'Roronoa Zoro', 'COLLECTIBLE', 'One Piece', 'NEW', null,
   'Figurine de collection One Piece, neuve et sous blister. Vendue en magasin et en ligne.',
   7499, null, 3, 1, false, false, true, 31),
  ('FIG-0003-SONGOK', 'figurine-son-goku-super-saiyan', 'Son Goku — Super Saiyan', 'COLLECTIBLE', 'Dragon Ball Z', 'NEW', null,
   'Figurine de collection Dragon Ball Z, neuve et sous blister. Vendue en magasin et en ligne.',
   8499, null, 2, 1, false, true, true, 32),
  ('FIG-0004-VEGETA', 'figurine-vegeta-super-saiyan-blue', 'Vegeta — Super Saiyan Blue', 'COLLECTIBLE', 'Dragon Ball Super', 'NEW', null,
   'Figurine de collection Dragon Ball Super, neuve et sous blister. Vendue en magasin et en ligne.',
   7999, null, 2, 1, false, false, true, 33),
  ('FIG-0005-NARUTO', 'figurine-naruto-uzumaki-mode-ermite', 'Naruto Uzumaki — mode Ermite', 'COLLECTIBLE', 'Naruto Shippuden', 'NEW', null,
   'Figurine de collection Naruto Shippuden, neuve et sous blister. Vendue en magasin et en ligne.',
   6999, null, 4, 1, false, false, true, 34),
  ('FIG-0006-KAKASH', 'figurine-kakashi-hatake', 'Kakashi Hatake', 'COLLECTIBLE', 'Naruto Shippuden', 'NEW', null,
   'Figurine de collection Naruto Shippuden, neuve et sous blister. Vendue en magasin et en ligne.',
   6499, null, 3, 1, false, false, true, 35),
  ('FIG-0007-TANJIR', 'figurine-tanjiro-kamado', 'Tanjiro Kamado', 'COLLECTIBLE', 'Demon Slayer', 'NEW', null,
   'Figurine de collection Demon Slayer, neuve et sous blister. Vendue en magasin et en ligne.',
   6999, null, 3, 1, false, false, true, 36),
  ('FIG-0008-NEZUKO', 'figurine-nezuko-kamado', 'Nezuko Kamado', 'COLLECTIBLE', 'Demon Slayer', 'NEW', null,
   'Figurine de collection Demon Slayer, neuve et sous blister. Vendue en magasin et en ligne.',
   6499, null, 3, 1, false, false, true, 37),
  ('FIG-0009-SATORU', 'figurine-satoru-gojo', 'Satoru Gojo', 'COLLECTIBLE', 'Jujutsu Kaisen', 'NEW', null,
   'Figurine de collection Jujutsu Kaisen, neuve et sous blister. Vendue en magasin et en ligne.',
   7999, null, 2, 1, false, true, true, 38),
  ('FIG-0010-YUJIIT', 'figurine-yuji-itadori', 'Yuji Itadori', 'COLLECTIBLE', 'Jujutsu Kaisen', 'NEW', null,
   'Figurine de collection Jujutsu Kaisen, neuve et sous blister. Vendue en magasin et en ligne.',
   5999, null, 3, 1, false, false, true, 39)
on conflict (slug) do update set
  name                   = excluded.name,
  category               = excluded.category,
  platform               = excluded.platform,
  condition              = excluded.condition,
  condition_notes        = excluded.condition_notes,
  description            = excluded.description,
  price_cents            = excluded.price_cents,
  compare_at_price_cents = excluded.compare_at_price_cents,
  quantity               = excluded.quantity,
  low_stock_threshold    = excluded.low_stock_threshold,
  is_retro               = excluded.is_retro,
  is_featured            = excluded.is_featured,
  is_active              = excluded.is_active,
  display_order          = excluded.display_order;
-- `images` et `specs` sont volontairement absents du `do update` : une photo
-- déposée par le magasin ne doit pas disparaître si ce fichier est rejoué.
