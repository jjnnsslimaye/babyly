create or replace function public.get_shop_feed(
  user_lat double precision,
  user_lng double precision,
  user_id uuid default null,
  radius_meters double precision default 80467,
  category_slug text default null,
  condition_filter text default null,
  max_price numeric default null,
  min_price numeric default null,
  page_size int default 20,
  page_cursor timestamptz default null
)
returns table (
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
  is_liked boolean,
  is_featured boolean,
  featured_until timestamptz,
  view_count int,
  like_count int,
  created_at timestamptz
)
language sql
stable
as $$
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
    and (page_cursor is null or l.created_at < page_cursor)
  order by
    l.is_featured desc,
    l.created_at desc
  limit page_size;
$$;

-- Allow public (unauthenticated) access to this function
grant execute on function public.get_shop_feed to anon, authenticated;