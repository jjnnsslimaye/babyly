-- Seed data for Shop listings
-- 10 paid item listings assigned to Sarah Mitchell (McKinney TX)

-- Insert listings
INSERT INTO listings (id, seller_id, title, description, condition, brand, category_id, price, location, location_label, attributes, payment_methods, is_featured, view_count, like_count, created_at, updated_at)
VALUES
  (
    '1a2b3c4d-5e6f-7890-1234-567890abcd01',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Uppababy Vista Stroller',
    'Excellent condition Vista stroller in gray. Includes bassinet, toddler seat, and rain cover. Hardly used, our baby preferred the carrier!',
    'gently_used',
    'Uppababy',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    150.00,
    ST_SetSRID(ST_MakePoint(-96.6297, 33.2072), 4326)::geography,
    'McKinney, TX',
    '{"type": "stroller", "color": "gray", "features": "bassinet included"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '13 days',
    NOW() - INTERVAL '13 days'
  ),
  (
    '2b3c4d5e-6f7a-8901-2345-67890abcd012',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Bundle of 3-6M girl clothes',
    'Adorable lot of 20+ pieces including dresses, onesies, and sleepers. All from smoke-free home. Brands include Carter''s, Old Navy, and Gap.',
    'like_new',
    'Carter''s',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    25.00,
    ST_SetSRID(ST_MakePoint(-96.6497, 33.1872), 4326)::geography,
    'McKinney, TX',
    '{"gender": "girl", "size": "3-6M", "type": "bundle"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '11 days',
    NOW() - INTERVAL '11 days'
  ),
  (
    '3c4d5e6f-7a8b-9012-3456-7890abcd0123',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Fisher Price Jumperoo',
    'Rainforest Jumperoo in great condition. Hours of entertainment! Lights and sounds all work perfectly. Easy to clean.',
    'gently_used',
    'Fisher Price',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    45.00,
    ST_SetSRID(ST_MakePoint(-96.6197, 33.2172), 4326)::geography,
    'McKinney, TX',
    '{"type": "activity center", "features": "lights and sounds"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '4d5e6f7a-8b9c-0123-4567-890abcd01234',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Wooden toy kitchen',
    'Beautiful wooden play kitchen with accessories. Includes pots, pans, utensils, and play food. Encourages imaginative play!',
    'like_new',
    'KidKraft',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    60.00,
    ST_SetSRID(ST_MakePoint(-96.6597, 33.1972), 4326)::geography,
    'McKinney, TX',
    '{"material": "wood", "type": "pretend play", "accessories": "included"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '5e6f7a8b-9c0d-1234-5678-90abcd012345',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Newborn girl coming home outfit',
    'Brand new with tags! Precious pink floral outfit with matching headband. Perfect for bringing baby girl home from the hospital.',
    'new_unopened',
    'Little Me',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    18.00,
    ST_SetSRID(ST_MakePoint(-96.6397, 33.2072), 4326)::geography,
    'McKinney, TX',
    '{"gender": "girl", "size": "newborn", "type": "outfit", "color": "pink"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    '6f7a8b9c-0d1e-2345-6789-0abcd0123456',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Chicco KeyFit 30 car seat',
    'Safe and reliable infant car seat. Never in an accident. Includes base, canopy, and infant insert. Expires 2027.',
    'gently_used',
    'Chicco',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    85.00,
    ST_SetSRID(ST_MakePoint(-96.6297, 33.1872), 4326)::geography,
    'McKinney, TX',
    '{"type": "car seat", "weight_limit": "4-30 lbs", "expiration": "2027"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '5 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '7a8b9c0d-1e2f-3456-7890-abcd01234567',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Melissa & Doug puzzle set',
    'Set of 4 wooden jigsaw puzzles. Great for toddlers developing problem-solving skills. Chunky pieces perfect for little hands.',
    'like_new',
    'Melissa & Doug',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    20.00,
    ST_SetSRID(ST_MakePoint(-96.6497, 33.2172), 4326)::geography,
    'McKinney, TX',
    '{"material": "wood", "type": "puzzle", "pieces": "4 puzzles", "age": "2+"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '8b9c0d1e-2f3a-4567-8901-bcd012345678',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    '0-3M boy onesie bundle',
    'Lot of 12 short-sleeve onesies in blues, grays, and patterns. All washed in Dreft. From pet-free, smoke-free home.',
    'gently_used',
    'Gerber',
    (SELECT id FROM categories WHERE slug = 'clothes' LIMIT 1),
    15.00,
    ST_SetSRID(ST_MakePoint(-96.6197, 33.1972), 4326)::geography,
    'McKinney, TX',
    '{"gender": "boy", "size": "0-3M", "type": "onesies", "quantity": "12"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '9c0d1e2f-3a4b-5678-9012-cd0123456789',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Baby Brezza formula maker',
    'Formula Pro Advanced - makes a perfect bottle at the perfect temperature instantly. Barely used, like new condition!',
    'like_new',
    'Baby Brezza',
    (SELECT id FROM categories WHERE slug = 'gear' LIMIT 1),
    95.00,
    ST_SetSRID(ST_MakePoint(-96.6597, 33.2072), 4326)::geography,
    'McKinney, TX',
    '{"type": "formula maker", "features": "automatic mixing and warming"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '0d1e2f3a-4b5c-6789-0123-d01234567890',
    '80722ba1-1d7f-4f0c-b186-29f7b6eee007',
    'Lovevery play kit',
    'The Inspector Play Kit for months 7-8. Brand new in box, unopened. Received as a gift but already had this one!',
    'new_unopened',
    'Lovevery',
    (SELECT id FROM categories WHERE slug = 'toys' LIMIT 1),
    75.00,
    ST_SetSRID(ST_MakePoint(-96.6397, 33.1872), 4326)::geography,
    'McKinney, TX',
    '{"age": "7-8 months", "type": "play kit", "condition": "sealed"}'::jsonb,
    '["cash", "venmo", "paypal"]'::jsonb,
    false,
    0,
    0,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  );

-- Insert listing_media (2 photos + 1 video per listing)
INSERT INTO listing_media (id, listing_id, listing_type, url, media_type, is_cover, sort_order, created_at)
VALUES
  -- Listing 1: Uppababy Vista Stroller
  (
    gen_random_uuid(),
    '1a2b3c4d-5e6f-7890-1234-567890abcd01',
    'listing',
    'https://images.unsplash.com/photo-1544126218913-a74ef8d0f6d9?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '13 days'
  ),
  (
    gen_random_uuid(),
    '1a2b3c4d-5e6f-7890-1234-567890abcd01',
    'listing',
    'https://images.unsplash.com/photo-1544126218913-a74ef8d0f6d9?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '13 days'
  ),
  (
    gen_random_uuid(),
    '1a2b3c4d-5e6f-7890-1234-567890abcd01',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '13 days'
  ),

  -- Listing 2: Bundle of 3-6M girl clothes
  (
    gen_random_uuid(),
    '2b3c4d5e-6f7a-8901-2345-67890abcd012',
    'listing',
    'https://images.unsplash.com/photo-1515488042361-ee00e41b4b1f?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '11 days'
  ),
  (
    gen_random_uuid(),
    '2b3c4d5e-6f7a-8901-2345-67890abcd012',
    'listing',
    'https://images.unsplash.com/photo-1515488042361-ee00e41b4b1f?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '11 days'
  ),
  (
    gen_random_uuid(),
    '2b3c4d5e-6f7a-8901-2345-67890abcd012',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '11 days'
  ),

  -- Listing 3: Fisher Price Jumperoo
  (
    gen_random_uuid(),
    '3c4d5e6f-7a8b-9012-3456-7890abcd0123',
    'listing',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '9 days'
  ),
  (
    gen_random_uuid(),
    '3c4d5e6f-7a8b-9012-3456-7890abcd0123',
    'listing',
    'https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '9 days'
  ),
  (
    gen_random_uuid(),
    '3c4d5e6f-7a8b-9012-3456-7890abcd0123',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '9 days'
  ),

  -- Listing 4: Wooden toy kitchen
  (
    gen_random_uuid(),
    '4d5e6f7a-8b9c-0123-4567-890abcd01234',
    'listing',
    'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '8 days'
  ),
  (
    gen_random_uuid(),
    '4d5e6f7a-8b9c-0123-4567-890abcd01234',
    'listing',
    'https://images.unsplash.com/photo-1522771930-78848d9293e8?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '8 days'
  ),
  (
    gen_random_uuid(),
    '4d5e6f7a-8b9c-0123-4567-890abcd01234',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '8 days'
  ),

  -- Listing 5: Newborn girl coming home outfit
  (
    gen_random_uuid(),
    '5e6f7a8b-9c0d-1234-5678-90abcd012345',
    'listing',
    'https://images.unsplash.com/photo-1560472354-b33ff0ad35a6?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(),
    '5e6f7a8b-9c0d-1234-5678-90abcd012345',
    'listing',
    'https://images.unsplash.com/photo-1560472354-b33ff0ad35a6?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '6 days'
  ),
  (
    gen_random_uuid(),
    '5e6f7a8b-9c0d-1234-5678-90abcd012345',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '6 days'
  ),

  -- Listing 6: Chicco KeyFit 30 car seat
  (
    gen_random_uuid(),
    '6f7a8b9c-0d1e-2345-6789-0abcd0123456',
    'listing',
    'https://images.unsplash.com/photo-1474176857975-6f4bb99c5282?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '5 days'
  ),
  (
    gen_random_uuid(),
    '6f7a8b9c-0d1e-2345-6789-0abcd0123456',
    'listing',
    'https://images.unsplash.com/photo-1474176857975-6f4bb99c5282?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '5 days'
  ),
  (
    gen_random_uuid(),
    '6f7a8b9c-0d1e-2345-6789-0abcd0123456',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '5 days'
  ),

  -- Listing 7: Melissa & Doug puzzle set
  (
    gen_random_uuid(),
    '7a8b9c0d-1e2f-3456-7890-abcd01234567',
    'listing',
    'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(),
    '7a8b9c0d-1e2f-3456-7890-abcd01234567',
    'listing',
    'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '4 days'
  ),
  (
    gen_random_uuid(),
    '7a8b9c0d-1e2f-3456-7890-abcd01234567',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '4 days'
  ),

  -- Listing 8: 0-3M boy onesie bundle
  (
    gen_random_uuid(),
    '8b9c0d1e-2f3a-4567-8901-bcd012345678',
    'listing',
    'https://images.unsplash.com/photo-1591348122449-02525d70379b?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(),
    '8b9c0d1e-2f3a-4567-8901-bcd012345678',
    'listing',
    'https://images.unsplash.com/photo-1591348122449-02525d70379b?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '3 days'
  ),
  (
    gen_random_uuid(),
    '8b9c0d1e-2f3a-4567-8901-bcd012345678',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '3 days'
  ),

  -- Listing 9: Baby Brezza formula maker
  (
    gen_random_uuid(),
    '9c0d1e2f-3a4b-5678-9012-cd0123456789',
    'listing',
    'https://images.unsplash.com/photo-1566004100631-35ebb10b91d7?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    '9c0d1e2f-3a4b-5678-9012-cd0123456789',
    'listing',
    'https://images.unsplash.com/photo-1566004100631-35ebb10b91d7?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '2 days'
  ),
  (
    gen_random_uuid(),
    '9c0d1e2f-3a4b-5678-9012-cd0123456789',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '2 days'
  ),

  -- Listing 10: Lovevery play kit
  (
    gen_random_uuid(),
    '0d1e2f3a-4b5c-6789-0123-d01234567890',
    'listing',
    'https://images.unsplash.com/photo-1519689680-65813d11cb23?w=800&q=80',
    'photo',
    true,
    0,
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    '0d1e2f3a-4b5c-6789-0123-d01234567890',
    'listing',
    'https://images.unsplash.com/photo-1519689680-65813d11cb23?w=800&q=80',
    'photo',
    false,
    1,
    NOW() - INTERVAL '1 day'
  ),
  (
    gen_random_uuid(),
    '0d1e2f3a-4b5c-6789-0123-d01234567890',
    'listing',
    'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    'video',
    false,
    2,
    NOW() - INTERVAL '1 day'
  );
