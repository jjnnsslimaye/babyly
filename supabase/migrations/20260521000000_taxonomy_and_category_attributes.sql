-- =========================================================================
-- Migration: Taxonomy and Category Attributes
-- Created: 2026-05-21
-- Description: Adds category index, reseeds locked taxonomy with fixed UUIDs,
--              creates category_attributes table, and sets up storage RLS
-- =========================================================================

-- =========================================================================
-- STEP 1 — Add index on categories.slug
-- =========================================================================

CREATE INDEX IF NOT EXISTS categories_slug_idx ON public.categories(slug);

-- =========================================================================
-- STEP 2 — Clear and reseed categories table
-- =========================================================================

-- Clear existing
DELETE FROM public.categories;

-- Top-level categories
INSERT INTO public.categories (id, parent_id, name, slug, icon, sort_order, is_active) VALUES
('c0000001-0000-0000-0000-000000000001', null, 'Clothes',   'clothes',   'shirt-outline',          1, true),
('c0000002-0000-0000-0000-000000000002', null, 'Gear',      'gear',      'bicycle-outline',        2, true),
('c0000003-0000-0000-0000-000000000003', null, 'Nursery',   'nursery',   'bed-outline',            3, true),
('c0000004-0000-0000-0000-000000000004', null, 'Toys',      'toys',      'game-controller-outline', 4, true),
('c0000005-0000-0000-0000-000000000005', null, 'Maternity', 'maternity', 'heart-outline',          5, true);

-- Clothes subcategories (none — attributes handle gender/size/type)

-- Gear subcategories
INSERT INTO public.categories (id, parent_id, name, slug, icon, sort_order, is_active) VALUES
('c0000010-0000-0000-0000-000000000010', 'c0000002-0000-0000-0000-000000000002', 'Strollers & Travel', 'gear-strollers-travel', null, 1, true),
('c0000011-0000-0000-0000-000000000011', 'c0000002-0000-0000-0000-000000000002', 'Sleep',              'gear-sleep',            null, 2, true),
('c0000012-0000-0000-0000-000000000012', 'c0000002-0000-0000-0000-000000000002', 'Feeding',            'gear-feeding',          null, 3, true),
('c0000013-0000-0000-0000-000000000013', 'c0000002-0000-0000-0000-000000000002', 'Diapering',          'gear-diapering',        null, 4, true),
('c0000014-0000-0000-0000-000000000014', 'c0000002-0000-0000-0000-000000000002', 'Safety',             'gear-safety',           null, 5, true),
('c0000015-0000-0000-0000-000000000015', 'c0000002-0000-0000-0000-000000000002', 'Bathing & Care',     'gear-bathing-care',     null, 6, true);

-- Nursery subcategories (none — it is itself a leaf for MVP)

-- Toys subcategories (none — attributes handle age/gender/type)

-- Maternity subcategories (none — attributes handle type/size)

-- =========================================================================
-- STEP 3 — Create category_attributes table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.category_attributes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_value text NOT NULL,
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS category_attributes_category_id_idx
  ON public.category_attributes(category_id);

CREATE INDEX IF NOT EXISTS category_attributes_key_idx
  ON public.category_attributes(category_id, attribute_key);

ALTER TABLE public.category_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active category attributes"
  ON public.category_attributes FOR SELECT
  USING (is_active = true);

-- =========================================================================
-- STEP 4 — Seed category_attributes
-- =========================================================================

-- -------------------------------------------------------------------------
-- CLOTHES attributes (c0000001)
-- -------------------------------------------------------------------------

-- gender
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000001-0000-0000-0000-000000000001', 'gender', 'Boy',    1),
('c0000001-0000-0000-0000-000000000001', 'gender', 'Girl',   2),
('c0000001-0000-0000-0000-000000000001', 'gender', 'Unisex', 3);

-- size
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000001-0000-0000-0000-000000000001', 'size', 'Preemie',  1),
('c0000001-0000-0000-0000-000000000001', 'size', 'NB',       2),
('c0000001-0000-0000-0000-000000000001', 'size', '0-3M',     3),
('c0000001-0000-0000-0000-000000000001', 'size', '3-6M',     4),
('c0000001-0000-0000-0000-000000000001', 'size', '6-9M',     5),
('c0000001-0000-0000-0000-000000000001', 'size', '9-12M',    6),
('c0000001-0000-0000-0000-000000000001', 'size', '12-18M',   7),
('c0000001-0000-0000-0000-000000000001', 'size', '18-24M',   8),
('c0000001-0000-0000-0000-000000000001', 'size', '2T',       9),
('c0000001-0000-0000-0000-000000000001', 'size', '3T',       10),
('c0000001-0000-0000-0000-000000000001', 'size', '4T',       11),
('c0000001-0000-0000-0000-000000000001', 'size', '5T',       12),
('c0000001-0000-0000-0000-000000000001', 'size', '6-7 (XS)', 13),
('c0000001-0000-0000-0000-000000000001', 'size', '8-10 (S)', 14),
('c0000001-0000-0000-0000-000000000001', 'size', '12-14 (M)',15);

-- type
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000001-0000-0000-0000-000000000001', 'type', 'Onesies & Bodysuits', 1),
('c0000001-0000-0000-0000-000000000001', 'type', 'Tops & T-Shirts',     2),
('c0000001-0000-0000-0000-000000000001', 'type', 'Bottoms',             3),
('c0000001-0000-0000-0000-000000000001', 'type', 'Dresses & Skirts',    4),
('c0000001-0000-0000-0000-000000000001', 'type', 'Sleepwear',           5),
('c0000001-0000-0000-0000-000000000001', 'type', 'Outerwear',           6),
('c0000001-0000-0000-0000-000000000001', 'type', 'Shoes',               7),
('c0000001-0000-0000-0000-000000000001', 'type', 'Swimwear',            8),
('c0000001-0000-0000-0000-000000000001', 'type', 'Sets & Bundles',      9);

-- -------------------------------------------------------------------------
-- GEAR subcategory attributes
-- -------------------------------------------------------------------------

-- Strollers & Travel (c0000010)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000010-0000-0000-0000-000000000010', 'type', 'Strollers',        1),
('c0000010-0000-0000-0000-000000000010', 'type', 'Carriers & Wraps', 2),
('c0000010-0000-0000-0000-000000000010', 'type', 'Travel Systems',   3);

-- Sleep (c0000011)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000011-0000-0000-0000-000000000011', 'type', 'Bassinets',           1),
('c0000011-0000-0000-0000-000000000011', 'type', 'Swings & Bouncers',   2),
('c0000011-0000-0000-0000-000000000011', 'type', 'Monitors',            3),
('c0000011-0000-0000-0000-000000000011', 'type', 'Sleep Sacks',         4),
('c0000011-0000-0000-0000-000000000011', 'type', 'White Noise Machines', 5);

-- Feeding (c0000012)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000012-0000-0000-0000-000000000012', 'type', 'High Chairs',          1),
('c0000012-0000-0000-0000-000000000012', 'type', 'Bottles & Accessories', 2),
('c0000012-0000-0000-0000-000000000012', 'type', 'Breast Pumps',         3),
('c0000012-0000-0000-0000-000000000012', 'type', 'Sterilizers',          4),
('c0000012-0000-0000-0000-000000000012', 'type', 'Bibs & Burp Cloths',   5);

-- Diapering (c0000013)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000013-0000-0000-0000-000000000013', 'type', 'Changing Tables', 1),
('c0000013-0000-0000-0000-000000000013', 'type', 'Diaper Bags',     2),
('c0000013-0000-0000-0000-000000000013', 'type', 'Cloth Diapers',   3);

-- Safety (c0000014)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000014-0000-0000-0000-000000000014', 'type', 'Baby Gates',    1),
('c0000014-0000-0000-0000-000000000014', 'type', 'Cabinet Locks', 2),
('c0000014-0000-0000-0000-000000000014', 'type', 'Proofing Kits', 3);

-- Bathing & Care (c0000015)
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000015-0000-0000-0000-000000000015', 'type', 'Baby Tubs',     1),
('c0000015-0000-0000-0000-000000000015', 'type', 'Bath Seats',    2),
('c0000015-0000-0000-0000-000000000015', 'type', 'Grooming Kits', 3);

-- -------------------------------------------------------------------------
-- NURSERY attributes (c0000003)
-- -------------------------------------------------------------------------

INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000003-0000-0000-0000-000000000003', 'type', 'Cribs & Toddler Beds', 1),
('c0000003-0000-0000-0000-000000000003', 'type', 'Dressers & Storage',   2),
('c0000003-0000-0000-0000-000000000003', 'type', 'Gliders & Rockers',    3),
('c0000003-0000-0000-0000-000000000003', 'type', 'Decor & Lighting',     4),
('c0000003-0000-0000-0000-000000000003', 'type', 'Rugs & Textiles',      5);

-- -------------------------------------------------------------------------
-- TOYS attributes (c0000004)
-- -------------------------------------------------------------------------

-- age_range
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000004-0000-0000-0000-000000000004', 'age_range', '0-6M',  1),
('c0000004-0000-0000-0000-000000000004', 'age_range', '6-12M', 2),
('c0000004-0000-0000-0000-000000000004', 'age_range', '1Y',    3),
('c0000004-0000-0000-0000-000000000004', 'age_range', '2Y',    4),
('c0000004-0000-0000-0000-000000000004', 'age_range', '3Y',    5),
('c0000004-0000-0000-0000-000000000004', 'age_range', '4Y',    6),
('c0000004-0000-0000-0000-000000000004', 'age_range', '5Y+',   7);

-- gender
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000004-0000-0000-0000-000000000004', 'gender', 'Boy',    1),
('c0000004-0000-0000-0000-000000000004', 'gender', 'Girl',   2),
('c0000004-0000-0000-0000-000000000004', 'gender', 'Unisex', 3);

-- type
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000004-0000-0000-0000-000000000004', 'type', 'Learning & Educational', 1),
('c0000004-0000-0000-0000-000000000004', 'type', 'Sensory & Infant',       2),
('c0000004-0000-0000-0000-000000000004', 'type', 'Outdoor & Sports',       3),
('c0000004-0000-0000-0000-000000000004', 'type', 'Stuffed Animals',        4),
('c0000004-0000-0000-0000-000000000004', 'type', 'Books',                  5),
('c0000004-0000-0000-0000-000000000004', 'type', 'Puzzles & Games',        6),
('c0000004-0000-0000-0000-000000000004', 'type', 'Arts & Crafts',          7),
('c0000004-0000-0000-0000-000000000004', 'type', 'Building & STEM',        8),
('c0000004-0000-0000-0000-000000000004', 'type', 'Ride-Ons',               9),
('c0000004-0000-0000-0000-000000000004', 'type', 'Musical',                10);

-- -------------------------------------------------------------------------
-- MATERNITY attributes (c0000005)
-- -------------------------------------------------------------------------

-- type
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000005-0000-0000-0000-000000000005', 'type', 'Tops & Shirts',       1),
('c0000005-0000-0000-0000-000000000005', 'type', 'Bottoms & Jeans',     2),
('c0000005-0000-0000-0000-000000000005', 'type', 'Dresses',             3),
('c0000005-0000-0000-0000-000000000005', 'type', 'Activewear',          4),
('c0000005-0000-0000-0000-000000000005', 'type', 'Sleepwear',           5),
('c0000005-0000-0000-0000-000000000005', 'type', 'Outerwear',           6),
('c0000005-0000-0000-0000-000000000005', 'type', 'Swimwear',            7),
('c0000005-0000-0000-0000-000000000005', 'type', 'Nursing & Postpartum', 8);

-- size
INSERT INTO public.category_attributes (category_id, attribute_key, attribute_value, sort_order) VALUES
('c0000005-0000-0000-0000-000000000005', 'size', 'XS',  1),
('c0000005-0000-0000-0000-000000000005', 'size', 'S',   2),
('c0000005-0000-0000-0000-000000000005', 'size', 'M',   3),
('c0000005-0000-0000-0000-000000000005', 'size', 'L',   4),
('c0000005-0000-0000-0000-000000000005', 'size', 'XL',  5),
('c0000005-0000-0000-0000-000000000005', 'size', 'XXL', 6);

-- =========================================================================
-- STEP 5 — Create listings Supabase Storage bucket and RLS
-- =========================================================================

-- IMPORTANT: Storage bucket creation must be done via Supabase dashboard
-- or the management API — it cannot be done in SQL migrations.
--
-- TO CREATE THE BUCKET:
-- 1. Go to Storage in Supabase dashboard
-- 2. Create new bucket named 'listings'
-- 3. Set as Public bucket
-- 4. The RLS policies below will apply once the bucket exists
--
-- The following RLS policies apply to the storage.objects table
-- for the 'listings' bucket, once created manually.

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload listing media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own listing media
CREATE POLICY "Users can update own listing media"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own listing media
CREATE POLICY "Users can delete own listing media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listings'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access to all listing media
CREATE POLICY "Anyone can view listing media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'listings');
