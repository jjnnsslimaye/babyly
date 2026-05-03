-- Seed data for Buy Nothing listings
-- 10 free item listings assigned to Sarah Mitchell

-- Insert buy_nothing_listings
INSERT INTO buy_nothing_listings (id, seller_id, title, description, condition, category_id, location, created_at, updated_at)
VALUES
  (
    'f1e2d3c4-b5a6-7890-1234-567890abcdef',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Graco Pack n Play',
    'Gently used Pack n Play with bassinet insert and changing table attachment. Clean and ready to use!',
    'gently_used',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6297, 33.2072), 4326)::geography,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Bundle of 0-3M onesies',
    'Lot of 15 onesies in various colors and patterns. All in excellent condition, very gently used.',
    'like_new',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6497, 33.1872), 4326)::geography,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Fisher Price bouncer',
    'Baby bouncer with calming vibrations. Our little one outgrew it! Works perfectly, batteries included.',
    'gently_used',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6197, 33.2172), 4326)::geography,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    'c3d4e5f6-a7b8-9012-3456-7890abcdef12',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Wooden stacking blocks',
    'Melissa & Doug wooden stacking blocks set. Great for developing motor skills. Like new condition!',
    'like_new',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6597, 33.1972), 4326)::geography,
    NOW() - INTERVAL '5 hours',
    NOW() - INTERVAL '5 hours'
  ),
  (
    'd4e5f6a7-b8c9-0123-4567-890abcdef123',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Newborn swaddles and blankets',
    'Set of 5 muslin swaddles and 3 receiving blankets. All washed and ready to use.',
    'gently_used',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6397, 33.2072), 4326)::geography,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    'e5f6a7b8-c9d0-1234-5678-90abcdef1234',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Baby books bundle',
    'Collection of 12 board books including classics like Goodnight Moon and The Very Hungry Caterpillar.',
    'used',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6297, 33.1872), 4326)::geography,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    'f6a7b8c9-d0e1-2345-6789-0abcdef12345',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Boppy nursing pillow',
    'Never used! Received as a gift but already had one. Still has tags.',
    'new_unopened',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6497, 33.2172), 4326)::geography,
    NOW() - INTERVAL '8 hours',
    NOW() - INTERVAL '8 hours'
  ),
  (
    'a7b8c9d0-e1f2-3456-7890-abcdef123456',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    '6-12M winter clothes lot',
    'Winter wardrobe for 6-12 month old. Includes sweaters, pants, jackets. Some like new, some gently used.',
    'gently_used',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6197, 33.1972), 4326)::geography,
    NOW() - INTERVAL '2 days 6 hours',
    NOW() - INTERVAL '2 days 6 hours'
  ),
  (
    'b8c9d0e1-f2a3-4567-8901-bcdef1234567',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Play mat with hanging toys',
    'Bright Starts activity gym with soft mat and detachable toys. Clean and in working condition.',
    'used',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6597, 33.2072), 4326)::geography,
    NOW() - INTERVAL '1 day 12 hours',
    NOW() - INTERVAL '1 day 12 hours'
  ),
  (
    'c9d0e1f2-a3b4-5678-9012-cdef12345678',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Diaper bag backpack',
    'Skip Hop diaper bag backpack in grey. Lots of pockets, stroller straps included. Great condition!',
    'like_new',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    ST_SetSRID(ST_MakePoint(-96.6397, 33.1872), 4326)::geography,
    NOW() - INTERVAL '3 days 4 hours',
    NOW() - INTERVAL '3 days 4 hours'
  );

-- Insert corresponding listing_media for cover photos
INSERT INTO listing_media (id, listing_id, listing_type, url, media_type, is_cover, sort_order, created_at)
VALUES
  (
    gen_random_uuid(),
    'f1e2d3c4-b5a6-7890-1234-567890abcdef',
    'buy_nothing',
    'https://images.unsplash.com/photo-1544126218913-a74ef8d0f6d9?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    'a1b2c3d4-e5f6-7890-1234-567890abcdef',
    'buy_nothing',
    'https://images.unsplash.com/photo-1519689373023-dd07c7988603?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    'b2c3d4e5-f6a7-8901-2345-67890abcdef1',
    'buy_nothing',
    'https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(),
    'c3d4e5f6-a7b8-9012-3456-7890abcdef12',
    'buy_nothing',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '5 hours'
  ),
  (
    gen_random_uuid(),
    'd4e5f6a7-b8c9-0123-4567-890abcdef123',
    'buy_nothing',
    'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(),
    'e5f6a7b8-c9d0-1234-5678-90abcdef1234',
    'buy_nothing',
    'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(),
    'f6a7b8c9-d0e1-2345-6789-0abcdef12345',
    'buy_nothing',
    'https://images.unsplash.com/photo-1584515933487-779824d29309?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '8 hours'
  ),
  (
    gen_random_uuid(),
    'a7b8c9d0-e1f2-3456-7890-abcdef123456',
    'buy_nothing',
    'https://images.unsplash.com/photo-1503944583220-79d8926ad5e2?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '2 days 6 hours'
  ),
  (
    gen_random_uuid(),
    'b8c9d0e1-f2a3-4567-8901-bcdef1234567',
    'buy_nothing',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '1 day 12 hours'
  ),
  (
    gen_random_uuid(),
    'c9d0e1f2-a3b4-5678-9012-cdef12345678',
    'buy_nothing',
    'https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '3 days 4 hours'
  );
