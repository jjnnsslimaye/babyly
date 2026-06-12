-- =========================================================================
-- Migration: Add brand_name to listing detail RPC functions
-- Replaces old text brand column with brand_name from brands table
-- =========================================================================

-- =========================================================================
-- get_listing_detail — add brand join and return brand_name
-- =========================================================================

create or replace function public.get_listing_detail(
  p_listing_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
as $$
declare
  v_result jsonb;
  v_listing record;
  v_seller record;
  v_media jsonb;
  v_is_liked boolean;
begin

  select
    l.id,
    l.title,
    l.description,
    l.price,
    l.condition,
    l.brand_id,
    b.name as brand_name,
    l.status,
    l.location_label,
    l.payment_methods,
    l.attributes,
    l.cover_photo_url,
    l.is_featured,
    l.view_count,
    l.like_count,
    l.created_at,
    l.seller_id,
    c.name as category_name,
    c.slug as category_slug
  into v_listing
  from public.listings l
  left join public.categories c on c.id = l.category_id
  left join public.brands b on b.id = l.brand_id
  where l.id = p_listing_id
    and l.status = 'available';

  if not found then
    return null;
  end if;

  select
    u.id,
    u.first_name,
    u.last_name,
    u.avatar_url,
    u.location_label,
    u.verification_status,
    u.total_listings,
    u.total_sold,
    u.created_at
  into v_seller
  from public.users u
  where u.id = v_listing.seller_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'url', m.url,
        'media_type', m.media_type,
        'sort_order', m.sort_order,
        'is_cover', m.is_cover
      ) order by m.sort_order asc
    ),
    '[]'::jsonb
  )
  into v_media
  from public.listing_media m
  where m.listing_id = p_listing_id
    and m.listing_type = 'listing';

  if v_media = '[]'::jsonb then
    v_media := jsonb_build_array(
      jsonb_build_object(
        'id', p_listing_id,
        'url', v_listing.cover_photo_url,
        'media_type', 'photo',
        'sort_order', 0,
        'is_cover', true
      )
    );
  end if;

  if p_user_id is not null then
    select exists (
      select 1 from public.listing_likes ll
      where ll.listing_id = p_listing_id
        and ll.user_id = p_user_id
        and ll.listing_type = 'listing'
    ) into v_is_liked;
  else
    v_is_liked := false;
  end if;

  v_result := jsonb_build_object(
    'id', v_listing.id,
    'title', v_listing.title,
    'description', v_listing.description,
    'price', v_listing.price,
    'condition', v_listing.condition,
    'brand_name', v_listing.brand_name,
    'status', v_listing.status,
    'location_label', v_listing.location_label,
    'payment_methods', v_listing.payment_methods,
    'attributes', v_listing.attributes,
    'cover_photo_url', v_listing.cover_photo_url,
    'is_featured', v_listing.is_featured,
    'view_count', v_listing.view_count,
    'like_count', v_listing.like_count,
    'created_at', v_listing.created_at,
    'category_name', v_listing.category_name,
    'category_slug', v_listing.category_slug,
    'media', v_media,
    'is_liked', v_is_liked,
    'seller', jsonb_build_object(
      'id', v_seller.id,
      'first_name', v_seller.first_name,
      'last_name', v_seller.last_name,
      'avatar_url', v_seller.avatar_url,
      'location_label', v_seller.location_label,
      'verification_status', v_seller.verification_status,
      'total_listings', v_seller.total_listings,
      'total_sold', v_seller.total_sold,
      'member_since', v_seller.created_at
    )
  );

  return v_result;

end;
$$;

grant execute on function public.get_listing_detail(uuid, uuid) to anon, authenticated;

-- =========================================================================
-- get_buy_nothing_detail — add brand join and return brand_name
-- =========================================================================

create or replace function public.get_buy_nothing_detail(
  p_listing_id uuid,
  p_user_id uuid default null
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_listing record;
  v_seller jsonb;
  v_media jsonb;
  v_is_liked boolean;
begin

  select
    bnl.id,
    bnl.title,
    bnl.description,
    bnl.condition,
    bnl.brand_id,
    b.name as brand_name,
    bnl.status,
    bnl.location_label,
    bnl.attributes,
    bnl.cover_photo_url,
    bnl.created_at,
    bnl.seller_id,
    c.name as category_name,
    c.slug as category_slug
  into v_listing
  from public.buy_nothing_listings bnl
  left join public.categories c on c.id = bnl.category_id
  left join public.brands b on b.id = bnl.brand_id
  where bnl.id = p_listing_id
    and bnl.status = 'available';

  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', u.id,
    'first_name', u.first_name,
    'last_name', u.last_name,
    'avatar_url', u.avatar_url,
    'location_label', u.location_label,
    'verification_status', u.verification_status,
    'total_listings', u.total_listings,
    'total_sold', u.total_sold,
    'member_since', u.created_at
  )
  into v_seller
  from public.users u
  where u.id = v_listing.seller_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'url', m.url,
        'media_type', m.media_type,
        'sort_order', m.sort_order,
        'is_cover', m.is_cover
      ) order by m.sort_order asc
    ), '[]'::jsonb
  )
  into v_media
  from public.listing_media m
  where m.listing_id = p_listing_id
    and m.listing_type = 'buy_nothing';

  if v_media = '[]'::jsonb then
    v_media := jsonb_build_array(
      jsonb_build_object(
        'id', p_listing_id,
        'url', v_listing.cover_photo_url,
        'media_type', 'photo',
        'sort_order', 0,
        'is_cover', true
      )
    );
  end if;

  if p_user_id is not null then
    select exists (
      select 1 from public.listing_likes ll
      where ll.listing_id = p_listing_id
        and ll.user_id = p_user_id
        and ll.listing_type = 'buy_nothing'
    ) into v_is_liked;
  else
    v_is_liked := false;
  end if;

  return jsonb_build_object(
    'id', v_listing.id,
    'title', v_listing.title,
    'description', v_listing.description,
    'condition', v_listing.condition,
    'brand_name', v_listing.brand_name,
    'status', v_listing.status,
    'location_label', v_listing.location_label,
    'attributes', v_listing.attributes,
    'cover_photo_url', v_listing.cover_photo_url,
    'created_at', v_listing.created_at,
    'category_name', v_listing.category_name,
    'category_slug', v_listing.category_slug,
    'media', v_media,
    'is_liked', v_is_liked,
    'seller', v_seller
  );
end;
$$;

grant execute on function public.get_buy_nothing_detail to anon, authenticated;
