-- Create get_buy_nothing_feed function for Buy Nothing screen
-- Follows same pattern as get_shop_feed but filters to buy_nothing_listings

create or replace function public.get_buy_nothing_feed(
  user_lat double precision,
  user_lng double precision,
  user_id uuid default null,
  radius_meters double precision default 80467,
  category_slug text default null,
  condition_filter text default null,
  search_query text default null,
  page_size int default 20,
  page_cursor timestamptz default null
)
returns table (
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
  is_liked boolean,
  created_at timestamptz
)
language sql
stable
as $$
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
    case
      when user_id is null then false
      else exists (
        select 1 from public.listing_likes ll
        where ll.listing_id = bnl.id
          and ll.user_id = get_buy_nothing_feed.user_id
          and ll.listing_type = 'buy_nothing'
      )
    end as is_liked,
    bnl.created_at
  from public.buy_nothing_listings bnl
  left join public.users u on u.id = bnl.seller_id
  left join public.categories c on c.id = bnl.category_id
  where
    (
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
    and (
      search_query is null
      or search_query = ''
      or bnl.title ilike '%' || search_query || '%'
      or bnl.description ilike '%' || search_query || '%'
    )
    and (page_cursor is null or bnl.created_at < page_cursor)
    and bnl.status = 'available'
  order by
    bnl.created_at desc
  limit page_size;
$$;

grant execute on function public.get_buy_nothing_feed to anon, authenticated;
