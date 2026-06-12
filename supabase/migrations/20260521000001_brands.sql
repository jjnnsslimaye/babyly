-- =========================================================================
-- Migration: Brands
-- Created: 2026-05-21
-- Description: Creates brands table, adds brand references to listings,
--              and seeds with curated brand list
-- =========================================================================

-- =========================================================================
-- STEP 1 — Create brands table
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.brands (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  slug       text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS brands_slug_idx ON public.brands(slug);
CREATE INDEX IF NOT EXISTS brands_name_idx ON public.brands(name);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active brands"
  ON public.brands FOR SELECT
  USING (is_active = true);

-- =========================================================================
-- STEP 2 — Add brand_id to listings tables
-- =========================================================================

-- Add brand_id column to listings
ALTER TABLE public.listings
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN brand_other text;

-- Add brand_id column to buy_nothing_listings
ALTER TABLE public.buy_nothing_listings
  ADD COLUMN brand_id uuid REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN brand_other text;

-- Note: existing brand text column is kept for now to avoid data loss
-- It will be removed in a future migration after confirmed clean

-- =========================================================================
-- STEP 3 — Seed brands table
-- =========================================================================

INSERT INTO public.brands (name, slug, sort_order) VALUES

-- Gear & Strollers
('UPPAbaby',        'uppababy',        1),
('Bugaboo',         'bugaboo',         2),
('Nuna',            'nuna',            3),
('Baby Jogger',     'baby-jogger',     4),
('Graco',           'graco',           5),
('Chicco',          'chicco',          6),
('Britax',          'britax',          7),
('Doona',           'doona',           8),
('Ergobaby',        'ergobaby',        9),
('Babybjorn',       'babybjorn',       10),
('Maclaren',        'maclaren',        11),
('BOB',             'bob',             12),
('Thule',           'thule',           13),
('Cybex',           'cybex',           14),
('Peg Perego',      'peg-perego',      15),
('Mockingbird',     'mockingbird',     16),
('Summer Infant',   'summer-infant',   17),
('Inglesina',       'inglesina',       18),

-- Sleep & Nursery
('Happiest Baby',   'happiest-baby',   19),
('4moms',           '4moms',           20),
('DockATot',        'dockatot',        21),
('Halo',            'halo',            22),
('Newton Baby',     'newton-baby',     23),
('Pottery Barn Kids','pottery-barn-kids',24),
('RH Baby & Child', 'rh-baby-child',   25),
('IKEA',            'ikea',            26),
('Babyletto',       'babyletto',       27),
('Dutailier',       'dutailier',       28),
('Delta Children',  'delta-children',  29),
('DaVinci',         'davinci',         30),

-- Feeding
('Owlet',           'owlet',           31),
('Elvie',           'elvie',           32),
('Spectra',         'spectra',         33),
('Medela',          'medela',          34),
('Willow',          'willow',          35),
('Haakaa',          'haakaa',          36),
('Nanobebe',        'nanobebe',        37),
('Comotomo',        'comotomo',        38),
('Tommee Tippee',   'tommee-tippee',   39),
('Dr. Brown''s',    'dr-browns',       40),
('Philips Avent',   'philips-avent',   41),
('Beaba',           'beaba',           42),
('OXO Tot',         'oxo-tot',         43),
('Stokke',          'stokke',          44),

-- Clothes
('Carter''s',       'carters',         45),
('OshKosh',         'oshkosh',         46),
('Gap Kids',        'gap-kids',        47),
('Old Navy',        'old-navy',        48),
('H&M Kids',        'hm-kids',         49),
('Zara Kids',       'zara-kids',       50),
('Primary',         'primary',         51),
('Boden',           'boden',           52),
('Tea Collection',  'tea-collection',  53),
('Hanna Andersson', 'hanna-andersson', 54),
('Janie and Jack',  'janie-and-jack',  55),
('Mini Boden',      'mini-boden',      56),
('Patagonia Kids',  'patagonia-kids',  57),
('Nike Kids',       'nike-kids',       58),
('North Face Kids', 'north-face-kids', 59),
('Lululemon Kids',  'lululemon-kids',  60),
('Gymboree',        'gymboree',        61),
('Cat & Jack',      'cat-and-jack',    62),
('Little Me',       'little-me',       63),
('Gerber',          'gerber',          64),

-- Toys
('LEGO',            'lego',            65),
('Melissa & Doug',  'melissa-and-doug',66),
('Fisher-Price',    'fisher-price',    67),
('Lovevery',        'lovevery',        68),
('Manhattan Toy',   'manhattan-toy',   69),
('Skip Hop',        'skip-hop',        70),
('Infantino',       'infantino',       71),
('Baby Einstein',   'baby-einstein',   72),
('VTech',           'vtech',           73),
('LeapFrog',        'leapfrog',        74),
('Magna-Tiles',     'magna-tiles',     75),
('Playmobil',       'playmobil',       76),
('HABA',            'haba',            77),
('PlanToys',        'plantoys',        78),

-- Maternity
('HATCH',           'hatch',           79),
('Seraphine',       'seraphine',       80),
('Motherhood Maternity','motherhood-maternity',81),
('A Pea in the Pod','a-pea-in-the-pod',82),
('Ingrid & Isabel', 'ingrid-and-isabel',83),
('Kindred Bravely', 'kindred-bravely', 84),
('Storq',           'storq',           85);
