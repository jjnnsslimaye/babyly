-- =========================================================================
-- Migration: Dynamic filters for shop and buy nothing feeds
-- Adds category_slug, brand_id, attribute_filters, fixes brand search
-- =========================================================================

-- =========================================================================
-- get_shop_feed — updated with full filter support
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_shop_feed(
  user_lat double precision,
  user_lng double precision,
  user_id uuid DEFAULT NULL::uuid,
  radius_meters double precision DEFAULT 80467,
  category_slug text DEFAULT NULL::text,
  condition_filter text DEFAULT NULL::text,
  max_price numeric DEFAULT NULL::numeric,
  min_price numeric DEFAULT NULL::numeric,
  search_query text DEFAULT NULL::text,
  brand_id uuid DEFAULT NULL::uuid,
  attribute_filters jsonb DEFAULT NULL::jsonb,
  page_size integer DEFAULT 20,
  page_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  title text,
  price numeric,
  condition text,
  cover_photo_url text,
  location_label text,
  distance_meters double precision,
  seller_id uuid,
  seller_first_name text,
  seller_avatar_url text,
  category_name text,
  brand_name text,
  is_liked boolean,
  is_featured boolean,
  featured_until timestamp with time zone,
  view_count integer,
  like_count integer,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
AS $function$
  select
    l.id,
    l.title,
    l.price,
    l.condition,
    l.cover_photo_url,
    l.location_label,
    ST_Distance(
      l.location,
      ST_GeogFromText('SRID=4326;POINT(' || user_lng || ' ' || user_lat || ')')
    ) as distance_meters,
    l.seller_id,
    u.first_name as seller_first_name,
    u.avatar_url as seller_avatar_url,
    c.name as category_name,
    b.name as brand_name,
    case
      when user_id is null then false
      else exists (
        select 1 from public.listing_likes ll
        where ll.listing_id = l.id
          and ll.user_id = get_shop_feed.user_id
          and ll.listing_type = 'listing'
      )
    end as is_liked,
    l.is_featured,
    l.featured_until,
    l.view_count,
    l.like_count,
    l.created_at
  from public.listings l
  left join public.users u on u.id = l.seller_id
  left join public.categories c on c.id = l.category_id
  left join public.brands b on b.id = l.brand_id
  where
    l.status = 'available'
    and (
      l.location is null
      or ST_DWithin(
        l.location,
        ST_GeogFromText('SRID=4326;POINT(' || user_lng || ' ' || user_lat || ')'),
        radius_meters
      )
    )
    and (category_slug is null or c.slug = category_slug or exists (
      select 1 from public.categories parent
      where parent.slug = category_slug and parent.id = c.parent_id
    ))
    and (condition_filter is null or l.condition = condition_filter)
    and (max_price is null or l.price <= max_price)
    and (min_price is null or l.price >= min_price)
    and (brand_id is null or l.brand_id = brand_id)
    and (attribute_filters is null or l.attributes @> attribute_filters)
    and (
      search_query is null
      or l.title ilike '%' || search_query || '%'
      or l.description ilike '%' || search_query || '%'
      or exists (
        select 1 from public.brands sb
        where sb.id = l.brand_id
          and sb.name ilike '%' || search_query || '%'
      )
    )
    and (page_cursor is null or l.created_at < page_cursor)
  order by
    l.is_featured desc,
    l.created_at desc
  limit page_size;
$function$;

grant execute on function public.get_shop_feed(double precision, double precision, uuid, double precision, text, text, numeric, numeric, text, uuid, jsonb, integer, timestamp with time zone) to anon, authenticated;

-- =========================================================================
-- get_buy_nothing_feed — updated with full filter support
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_buy_nothing_feed(
  user_lat double precision,
  user_lng double precision,
  user_id uuid DEFAULT NULL::uuid,
  radius_meters double precision DEFAULT 80467,
  category_slug text DEFAULT NULL::text,
  condition_filter text DEFAULT NULL::text,
  search_query text DEFAULT NULL::text,
  brand_id uuid DEFAULT NULL::uuid,
  attribute_filters jsonb DEFAULT NULL::jsonb,
  page_size integer DEFAULT 20,
  page_cursor timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  title text,
  condition text,
  cover_photo_url text,
  location_label text,
  distance_meters double precision,
  seller_id uuid,
  seller_first_name text,
  seller_avatar_url text,
  category_name text,
  brand_name text,
  is_liked boolean,
  view_count integer,
  like_count integer,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE
AS $function$
  select
    bnl.id,
    bnl.title,
    bnl.condition,
    bnl.cover_photo_url,
    bnl.location_label,
    ST_Distance(
      bnl.location,
      ST_GeogFromText('SRID=4326;POINT(' || user_lng || ' ' || user_lat || ')')
    ) as distance_meters,
    bnl.seller_id,
    u.first_name as seller_first_name,
    u.avatar_url as seller_avatar_url,
    c.name as category_name,
    b.name as brand_name,
    case
      when user_id is null then false
      else exists (
        select 1 from public.listing_likes ll
        where ll.listing_id = bnl.id
          and ll.user_id = get_buy_nothing_feed.user_id
          and ll.listing_type = 'buy_nothing'
      )
    end as is_liked,
    bnl.view_count,
    bnl.like_count,
    bnl.created_at
  from public.buy_nothing_listings bnl
  left join public.users u on u.id = bnl.seller_id
  left join public.categories c on c.id = bnl.category_id
  left join public.brands b on b.id = bnl.brand_id
  where
    bnl.status = 'available'
    and (
      bnl.location is null
      or ST_DWithin(
        bnl.location,
        ST_GeogFromText('SRID=4326;POINT(' || user_lng || ' ' || user_lat || ')'),
        radius_meters
      )
    )
    and (category_slug is null or c.slug = category_slug or exists (
      select 1 from public.categories parent
      where parent.slug = category_slug and parent.id = c.parent_id
    ))
    and (condition_filter is null or bnl.condition = condition_filter)
    and (brand_id is null or bnl.brand_id = brand_id)
    and (attribute_filters is null or bnl.attributes @> attribute_filters)
    and (
      search_query is null
      or bnl.title ilike '%' || search_query || '%'
      or bnl.description ilike '%' || search_query || '%'
      or exists (
        select 1 from public.brands sb
        where sb.id = bnl.brand_id
          and sb.name ilike '%' || search_query || '%'
      )
    )
    and (page_cursor is null or bnl.created_at < page_cursor)
  order by
    bnl.created_at desc
  limit page_size;
$function$;

grant execute on function public.get_buy_nothing_feed(double precision, double precision, uuid, double precision, text, text, text, uuid, jsonb, integer, timestamp with time zone) to anon, authenticated;
