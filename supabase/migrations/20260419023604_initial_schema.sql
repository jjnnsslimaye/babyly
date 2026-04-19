-- Enable PostGIS for location-based queries
create extension if not exists postgis;

-- ─── USERS ───────────────────────────────────────────────
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  username text unique,
  first_name text,
  last_name text,
  avatar_url text,
  location geography(point, 4326),
  location_label text,
  bio text,
  account_tier text not null default 'free' check (account_tier in ('free', 'premium')),
  subscription_expires_at timestamptz,
  verification_status text not null default 'none' check (verification_status in ('none', 'id_verified', 'background_checked')),
  verification_provider text,
  verification_completed_at timestamptz,
  total_listings int not null default 0,
  total_sold int not null default 0,
  is_online boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS
alter table public.users enable row level security;

create policy "Users can view any profile"
  on public.users for select
  using (true);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.users for insert
  with check (auth.uid() = id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CATEGORIES ──────────────────────────────────────────
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  icon text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.categories enable row level security;

create policy "Anyone can view active categories"
  on public.categories for select
  using (is_active = true);

-- ─── LISTINGS ────────────────────────────────────────────
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  price numeric(10,2) not null check (price >= 0),
  status text not null default 'available' check (status in ('available', 'pending', 'sold')),
  condition text not null check (condition in ('new_unopened', 'like_new', 'gently_used', 'used')),
  brand text,
  location geography(point, 4326),
  location_label text,
  cover_photo_url text,
  payment_methods jsonb not null default '[]',
  attributes jsonb not null default '{}',
  is_featured boolean not null default false,
  featured_until timestamptz,
  boost_impressions int not null default 0,
  view_count int not null default 0,
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for feed queries
create index listings_seller_id_idx on public.listings(seller_id);
create index listings_category_id_idx on public.listings(category_id);
create index listings_status_idx on public.listings(status);
create index listings_created_at_idx on public.listings(created_at desc);
create index listings_location_idx on public.listings using gist(location);
create index listings_attributes_idx on public.listings using gin(attributes);

-- RLS
alter table public.listings enable row level security;

create policy "Anyone can view available listings"
  on public.listings for select
  using (status = 'available');

create policy "Sellers can insert own listings"
  on public.listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own listings"
  on public.listings for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete own listings"
  on public.listings for delete
  using (auth.uid() = seller_id);

-- ─── BUY NOTHING LISTINGS ────────────────────────────────
create table public.buy_nothing_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'available' check (status in ('available', 'pending', 'claimed')),
  condition text not null check (condition in ('new_unopened', 'like_new', 'gently_used', 'used')),
  brand text,
  location geography(point, 4326),
  location_label text,
  cover_photo_url text,
  attributes jsonb not null default '{}',
  view_count int not null default 0,
  like_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index buy_nothing_seller_id_idx on public.buy_nothing_listings(seller_id);
create index buy_nothing_status_idx on public.buy_nothing_listings(status);
create index buy_nothing_created_at_idx on public.buy_nothing_listings(created_at desc);
create index buy_nothing_location_idx on public.buy_nothing_listings using gist(location);

-- RLS
alter table public.buy_nothing_listings enable row level security;

create policy "Anyone can view available buy nothing listings"
  on public.buy_nothing_listings for select
  using (status = 'available');

create policy "Sellers can insert own buy nothing listings"
  on public.buy_nothing_listings for insert
  with check (auth.uid() = seller_id);

create policy "Sellers can update own buy nothing listings"
  on public.buy_nothing_listings for update
  using (auth.uid() = seller_id);

create policy "Sellers can delete own buy nothing listings"
  on public.buy_nothing_listings for delete
  using (auth.uid() = seller_id);

-- ─── LISTING MEDIA ───────────────────────────────────────
create table public.listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  listing_type text not null check (listing_type in ('listing', 'buy_nothing')),
  url text not null,
  media_type text not null check (media_type in ('photo', 'video')),
  sort_order int not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now()
);

-- Indexes
create index listing_media_listing_id_idx on public.listing_media(listing_id);

-- RLS
alter table public.listing_media enable row level security;

create policy "Anyone can view listing media"
  on public.listing_media for select
  using (true);

create policy "Sellers can insert own listing media"
  on public.listing_media for insert
  with check (
    auth.uid() = (
      select seller_id from public.listings where id = listing_id
      union
      select seller_id from public.buy_nothing_listings where id = listing_id
      limit 1
    )
  );

-- ─── LISTING LIKES ───────────────────────────────────────
create table public.listing_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  listing_id uuid not null,
  listing_type text not null check (listing_type in ('listing', 'buy_nothing')),
  created_at timestamptz not null default now(),
  unique(user_id, listing_id, listing_type)
);

-- Indexes
create index listing_likes_user_id_idx on public.listing_likes(user_id);
create index listing_likes_listing_id_idx on public.listing_likes(listing_id);

-- RLS
alter table public.listing_likes enable row level security;

create policy "Users can view own likes"
  on public.listing_likes for select
  using (auth.uid() = user_id);

create policy "Users can insert own likes"
  on public.listing_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own likes"
  on public.listing_likes for delete
  using (auth.uid() = user_id);

-- ─── UPDATED AT TRIGGER ──────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger handle_listings_updated_at
  before update on public.listings
  for each row execute procedure public.handle_updated_at();

create trigger handle_buy_nothing_updated_at
  before update on public.buy_nothing_listings
  for each row execute procedure public.handle_updated_at();

create trigger handle_users_updated_at
  before update on public.users
  for each row execute procedure public.handle_updated_at();