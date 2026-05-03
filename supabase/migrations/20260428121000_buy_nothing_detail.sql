-- Create get_buy_nothing_detail function for Buy Nothing listing detail screen
-- Returns complete listing details with seller info, media, and like status

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
  -- Get listing details
  select
    bnl.id,
    bnl.title,
    bnl.description,
    bnl.condition,
    bnl.brand,
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
  where bnl.id = p_listing_id
    and bnl.status = 'available';

  -- If listing not found, return null
  if not found then
    return null;
  end if;

  -- Get seller details
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

  -- Get media
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

  -- Fallback to cover_photo_url if no media
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

  -- Check if user has liked this listing
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

  -- Build and return result
  return jsonb_build_object(
    'id', v_listing.id,
    'title', v_listing.title,
    'description', v_listing.description,
    'condition', v_listing.condition,
    'brand', v_listing.brand,
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
