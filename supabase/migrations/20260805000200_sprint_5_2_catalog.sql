-- LEVIEN CAFE — Sprint 5.2 Catalog Migration
-- Run after Sprint 5.1 foundation. Idempotent: safe to run once again if needed.

insert into public.categories (id, name, icon, active, sort_order) values
('10000000-0000-0000-0000-000000000001', 'Vietnamese Coffee', '☕', true, 1),
('10000000-0000-0000-0000-000000000002', 'Milk Tea', '🧋', true, 2),
('10000000-0000-0000-0000-000000000003', 'Smoothies', '🥤', true, 3),
('10000000-0000-0000-0000-000000000004', 'Bánh Mì', '🥖', true, 4),
('10000000-0000-0000-0000-000000000005', 'Chicken & More', '🍗', true, 5)
on conflict (id) do update set name=excluded.name, icon=excluded.icon, active=excluded.active, sort_order=excluded.sort_order;

insert into public.toppings (id, name, price, active) values
('20000000-0000-0000-0000-000000000001', 'Salted Cream', 1.25, true),
('20000000-0000-0000-0000-000000000002', 'Egg Cream', 1.25, true),
('20000000-0000-0000-0000-000000000003', 'Boba', 1.00, true),
('20000000-0000-0000-0000-000000000004', 'Extra Espresso Shot', 1.50, true)
on conflict (id) do update set name=excluded.name, price=excluded.price, active=excluded.active;

insert into public.products (
  id, category_id, name, description, price, image_url, emoji,
  allow_ice, allow_sugar, allow_toppings, best_seller, must_try,
  featured, is_new, sold_out, active, sort_order
) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Vietnamese Milk Coffee','Bold coffee with condensed milk.',4.99,'','☕',true,true,true,true,false,true,false,false,true,1),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','Brown Marble Milk Tea','Brown sugar milk tea with boba.',5.49,'','🧋',true,true,true,true,true,false,false,false,true,2),
('30000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','Ube Coffee','Vietnamese coffee with sweet ube cream.',5.49,'','🟣',true,true,true,true,true,false,true,false,true,3),
('30000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000003','Coconut Mung Bean Frap','Creamy coconut and mung bean blend.',5.99,'','🥥',true,true,false,true,false,false,false,false,true,4),
('30000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','Matcha Frap','Smooth matcha blended until creamy.',5.49,'','🍵',true,true,false,false,true,false,false,false,true,5),
('30000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000002','Oolong Milk Tea','Fragrant oolong tea with creamy milk.',5.95,'','🧋',true,true,true,false,false,false,false,false,true,6),
('30000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000004','Grilled Pork Bánh Mì','Grilled pork, crisp vegetables and fresh bread.',8.95,'','🥖',false,false,false,true,true,false,false,false,true,7),
('30000000-0000-0000-0000-000000000008','10000000-0000-0000-0000-000000000005','Soy Garlic Wings','Crispy wings with a glossy soy garlic glaze.',10.95,'','🍗',false,false,false,false,false,true,false,false,true,8),
('30000000-0000-0000-0000-000000000009','10000000-0000-0000-0000-000000000002','Strawberry Matcha Latte','Fresh strawberry layered with smooth matcha.',6.49,'','🍓',true,true,true,false,false,false,true,false,true,9),
('30000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000003','Avocado Smoothie','Fresh avocado, rich and silky.',6.75,'','🥑',true,true,false,false,false,false,false,false,true,10),
('30000000-0000-0000-0000-000000000011','10000000-0000-0000-0000-000000000004','Shrimp Katsu Sandwich','Crispy shrimp katsu with house sauce.',9.95,'','🥪',false,false,false,false,true,false,false,false,true,11),
('30000000-0000-0000-0000-000000000012','10000000-0000-0000-0000-000000000005','Spicy K Wings','Crispy wings in a bold Korean-style glaze.',10.95,'','🔥',false,false,false,false,false,false,true,false,true,12)
on conflict (id) do update set
  category_id=excluded.category_id, name=excluded.name, description=excluded.description,
  price=excluded.price, image_url=excluded.image_url, emoji=excluded.emoji,
  allow_ice=excluded.allow_ice, allow_sugar=excluded.allow_sugar,
  allow_toppings=excluded.allow_toppings, best_seller=excluded.best_seller,
  must_try=excluded.must_try, featured=excluded.featured, is_new=excluded.is_new,
  sold_out=excluded.sold_out, active=excluded.active, sort_order=excluded.sort_order;

insert into public.product_toppings (product_id, topping_id) values
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000004'),
('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000003'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001'),
('30000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000004'),
('30000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000003'),
('30000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000003')
on conflict do nothing;

insert into public.combos (id, name, description, price, image_url, active, sort_order) values
('40000000-0000-0000-0000-000000000001','Coffee & Bánh Mì Combo','Vietnamese milk coffee paired with a fresh grilled pork bánh mì.',10.99,'',true,1)
on conflict (id) do update set name=excluded.name, description=excluded.description, price=excluded.price, image_url=excluded.image_url, active=excluded.active, sort_order=excluded.sort_order;

insert into public.combo_products (combo_id, product_id, position) values
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1),
('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000007',2)
on conflict (combo_id, product_id) do update set position=excluded.position;

insert into public.promotions (id, name, eyebrow, description, price_text, image_url, active, sort_order) values
('50000000-0000-0000-0000-000000000001','Vietnamese Milk Coffee','Morning special','Bold Vietnamese coffee with creamy condensed milk. Available every day from 7 AM to 9 AM.','Only $4.99','',true,1),
('50000000-0000-0000-0000-000000000002','Coffee & Bánh Mì','Combo deal','A satisfying Vietnamese coffee and fresh bánh mì pairing.','$10.99','',true,2),
('50000000-0000-0000-0000-000000000003','Ube Coffee','New arrival','Sweet ube cream layered with bold Vietnamese coffee.','$5.49','',true,3)
on conflict (id) do update set name=excluded.name, eyebrow=excluded.eyebrow, description=excluded.description, price_text=excluded.price_text, image_url=excluded.image_url, active=excluded.active, sort_order=excluded.sort_order;

update public.site_content set
  announcement='Fresh Vietnamese coffee & bánh mì every day',
  about_title='Vietnamese soul, made for the neighborhood.',
  about_text='LEVIEN CAFE brings together bold Vietnamese coffee, handcrafted drinks and fresh comfort food in a warm, modern space.',
  email='hello@leviencafe.com',
  map_url='https://www.google.com/maps/search/?api=1&query=600+Washington+Ave+Unit+18C+Philadelphia'
where singleton_key='main';
