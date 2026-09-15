-- ---------------------------------------------------------------------------
-- Les photos du rayon, et rien d'autre.
--
-- POURQUOI CE FICHIER EXISTE
--
-- `seed-boutique.sql` pose le rayon complet : noms, prix, stock, état, photos.
-- Le rejouer réécrit donc les prix et les quantités avec ceux du fichier — ce
-- qui efface tout ce que le magasin a corrigé depuis dans `/admin/stock`.
--
-- Celui-ci ne fait que deux choses, et ne touche à rien d'autre :
--
--   1. il renseigne la photo des articles qui n'en ont pas encore ;
--   2. il retire le seul article sans visuel correspondant.
--
-- Les prix, les quantités, les états, les descriptions ne sont pas touchés.
-- Une photo déjà déposée au back-office n'est pas écrasée (`and images =
-- '{}'`). Rejouable autant de fois qu'on veut.
--
-- COMMENT L'APPLIQUER
--
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/photos-boutique.sql
--
-- ou en collant tout ce fichier dans le SQL Editor de Supabase, puis « Run ».
--
-- Les fichiers eux-mêmes sont dans `public/images/produit/`, livrés avec le
-- site : rien à téléverser.
-- ---------------------------------------------------------------------------

update public.products set images = array['/images/produit/EA Sports FC 26 PS5 boîte face avant.jpg']
 where slug = 'ea-sports-fc-26-ps5' and images = '{}';
update public.products set images = array['/images/produit/Mario Kart World Nintendo Switch 2 boîte.jpg']
 where slug = 'mario-kart-world-switch-2' and images = '{}';
update public.products set images = array['/images/produit/The Legend of Zelda Tears of the Kingdom Nintendo Switch boîte.webp']
 where slug = 'zelda-tears-of-the-kingdom-switch' and images = '{}';
update public.products set images = array['/images/produit/Elden Ring PS5 boîte.jpg']
 where slug = 'elden-ring-ps5' and images = '{}';
update public.products set images = array['/images/produit/God of War Ragnarok PS5 boîte.jpg']
 where slug = 'god-of-war-ragnarok-ps5' and images = '{}';
update public.products set images = array['/images/produit/Hogwarts Legacy Xbox Series X boîte.jpg']
 where slug = 'hogwarts-legacy-xbox-series-x' and images = '{}';
update public.products set images = array['/images/produit/Super Mario Odyssey Nintendo Switch boîte.jpg']
 where slug = 'super-mario-odyssey-switch' and images = '{}';
update public.products set images = array['/images/produit/Forza Horizon 5 Xbox Series X boîte.jpg']
 where slug = 'forza-horizon-5-xbox-series-x' and images = '{}';
update public.products set images = array['/images/produit/Final Fantasy VII Rebirth PS5 boîte.jpg']
 where slug = 'final-fantasy-vii-rebirth-ps5' and images = '{}';
update public.products set images = array['/images/produit/Pokémon Écarlate Nintendo Switch boîte.jpg']
 where slug = 'pokemon-ecarlate-switch' and images = '{}';
update public.products set images = array['/images/produit/PlayStation 5 Slim édition disque console.jpg']
 where slug = 'playstation-5-slim-edition-disque' and images = '{}';
update public.products set images = array['/images/produit/PlayStation 5 Digital Edition console.webp']
 where slug = 'playstation-5-edition-numerique-revisee' and images = '{}';
update public.products set images = array['/images/produit/Xbox Series X 1TB console.png']
 where slug = 'xbox-series-x-1-to' and images = '{}';
update public.products set images = array['/images/produit/Xbox Series S 512GB console.png']
 where slug = 'xbox-series-s-512-go' and images = '{}';
update public.products set images = array['/images/produit/Nintendo Switch OLED console white.jpg']
 where slug = 'nintendo-switch-oled' and images = '{}';
update public.products set images = array['/images/produit/Steam Deck OLED 512GB console.jpg']
 where slug = 'steam-deck-oled-512-go' and images = '{}';
update public.products set images = array['/images/produit/PlayStation 4 Pro 1TB console.webp', '/images/produit/2893211-sony-ps4-pro-noir-1-to-1-manette.webp']
 where slug = 'playstation-4-pro-1-to-revisee' and images = '{}';
update public.products set images = array['/images/produit/Nintendo 64 console.jpg']
 where slug = 'nintendo-64-revisee' and images = '{}';
update public.products set images = array['/images/produit/Super Nintendo SNES console.jpg']
 where slug = 'super-nintendo-revisee' and images = '{}';
update public.products set images = array['/images/produit/Monkey D Luffy Gear 5 figurine One Piece.jpg']
 where slug = 'figurine-monkey-d-luffy-gear-5' and images = '{}';
update public.products set images = array['/images/produit/Roronoa Zoro figurine One Piece.webp']
 where slug = 'figurine-roronoa-zoro' and images = '{}';
update public.products set images = array['/images/produit/Son Goku Super Saiyan figurine Dragon Ball Z.webp']
 where slug = 'figurine-son-goku-super-saiyan' and images = '{}';
update public.products set images = array['/images/produit/Vegeta Super Saiyan Blue figurine Dragon Ball Super.jpg']
 where slug = 'figurine-vegeta-super-saiyan-blue' and images = '{}';
update public.products set images = array['/images/produit/Naruto Uzumaki Sage Mode figurine.jpg']
 where slug = 'figurine-naruto-uzumaki-mode-ermite' and images = '{}';
update public.products set images = array['/images/produit/Kakashi Hatake figurine Naruto.jpg']
 where slug = 'figurine-kakashi-hatake' and images = '{}';
update public.products set images = array['/images/produit/Tanjiro Kamado figurine Demon Slayer.jpg']
 where slug = 'figurine-tanjiro-kamado' and images = '{}';
update public.products set images = array['/images/produit/Nezuko Kamado figurine Demon Slayer.webp']
 where slug = 'figurine-nezuko-kamado' and images = '{}';
update public.products set images = array['/images/produit/Satoru Gojo figurine Jujutsu Kaisen.jpg']
 where slug = 'figurine-satoru-gojo' and images = '{}';
update public.products set images = array['/images/produit/Yuji Itadori figurine Jujutsu Kaisen.jpg']
 where slug = 'figurine-yuji-itadori' and images = '{}';

-- ---------------------------------------------------------------------------
-- Le rayon ne garde aucun article sans photo.
--
-- Aucun fichier de `public/images/produit/` ne correspond à la Nintendo Switch
-- modèle 2019, et lui donner le visuel d'un autre modèle de Switch reviendrait
-- à montrer autre chose que ce qui est vendu.
--
-- Sans danger : les mouvements de stock suivent en cascade, et les lignes de
-- commande déjà passées gardent leur libellé et leur prix (`on delete set
-- null`). Aucun historique de vente n'est perdu.
-- ---------------------------------------------------------------------------
delete from public.products where slug = 'nintendo-switch-2019-revisee';

-- Contrôle : doit renvoyer 29 articles et 0 sans photo.
select count(*) as articles, count(*) filter (where images = '{}') as sans_photo
  from public.products;
