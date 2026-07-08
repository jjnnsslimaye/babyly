import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useAuth } from '../_layout';
import { setLikeUpdate } from '../../lib/likeStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = SCREEN_WIDTH * 1.0;

type MediaItem = {
  id: string;
  url: string;
  media_type: 'photo' | 'video';
  sort_order: number;
  is_cover: boolean;
};

type Seller = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  location_label: string;
  verification_status: string;
  total_listings: number;
  total_sold: number;
  member_since: string;
};

type BaseListing = {
  id: string;
  title: string;
  description: string;
  condition: string;
  brand_name: string | null;
  status: string;
  location_label: string;
  attributes: Record<string, string>;
  cover_photo_url: string;
  created_at: string;
  category_name: string;
  category_slug: string;
  is_liked: boolean;
  media: MediaItem[];
  seller: Seller;
  seller_id: string;
};

type ShopListing = BaseListing & {
  kind: 'listing';
  price: number;
  payment_methods: string[];
  is_featured: boolean;
  view_count: number;
  like_count: number;
};

type FreeItem = BaseListing & {
  kind: 'buy_nothing';
};

type ListingDetail = ShopListing | FreeItem;

function formatCondition(condition: string): string {
  const conditionMap: Record<string, string> = {
    new_unopened: 'New (Unopened)',
    like_new: 'Like New',
    gently_used: 'Gently Used',
    used: 'Used',
  };
  return conditionMap[condition] || condition;
}

function formatPrice(price: number): string {
  if (Number.isInteger(price)) {
    return `$${price}`;
  }
  return `$${price.toFixed(2)}`;
}

function humanizeKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function VideoCarouselItem({ item }: { item: MediaItem }) {
  const player = useVideoPlayer(item.url, (p) => {
    p.loop = true;
    p.muted = false;
  });

  return (
    <View style={styles.carouselItem}>
      <VideoView
        player={player}
        style={styles.carouselImage}
        contentFit="cover"
        nativeControls={true}
      />
    </View>
  );
}

function CarouselItem({ item }: { item: MediaItem }) {
  if (item.media_type === 'video') {
    return <VideoCarouselItem item={item} />;
  }

  return (
    <View style={styles.carouselItem}>
      <Image
        source={{ uri: item.url }}
        style={styles.carouselImage}
        resizeMode="cover"
      />
    </View>
  );
}

export default function ListingDetail() {
  const router = useRouter();
  const { id, type } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const isBuyNothing = type === 'buy_nothing';
  const { session } = useAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [contactingSeller, setContactingSeller] = useState(false);

  const viewabilityConfig = useRef({
    minimumViewTime: 100,
    viewAreaCoveragePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentImageIndex(viewableItems[0].index || 0);
    }
  }).current;

  useEffect(() => {
    fetchListing();
  }, [id, session?.user?.id]);

  const fetchListing = async () => {
    try {
      setLoading(true);
      setError(false);

      if (isBuyNothing) {
        const { data, error: fetchError } = await supabase.rpc('get_buy_nothing_detail', {
          p_listing_id: id,
          p_user_id: session?.user?.id || null,
        });

        if (fetchError || !data) {
          setError(true);
          return;
        }

        setListing({ ...data, kind: 'buy_nothing' });
      } else {
        const { data, error: fetchError } = await supabase.rpc('get_listing_detail', {
          p_listing_id: id,
          p_user_id: session?.user?.id || null,
        });

        if (fetchError || !data) {
          setError(true);
          return;
        }

        setListing({ ...data, kind: 'listing' });
      }
    } catch (err) {
      console.error('Error fetching listing:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!listing) return;

    try {
      await Share.share({
        message: listing.kind === 'listing'
          ? `${listing.title} — ${formatPrice(listing.price)} on Babyly\nhttps://babyly.app/listing/${listing.id}`
          : `${listing.title} — Free on Babyly\nhttps://babyly.app/listing/${listing.id}`,
      });
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleReportListing = () => {
    Alert.alert(
      'Report listing',
      'Thank you for helping keep Babyly safe. Our team will review this listing.',
      [{ text: 'OK' }]
    );
  };

  const handleToggleLike = async () => {
    if (!listing) return;

    if (!session?.user?.id) {
      router.push('/login');
      return;
    }

    if (isOwnListing) return;

    const listingType = listing.kind === 'listing' ? 'listing' : 'buy_nothing';
    const currentIsLiked = listing.is_liked;
    const currentLikeCount = listing.kind === 'listing' ? listing.like_count : 0;
    const desiredLiked = !currentIsLiked;

    // Optimistic update
    setListing(prev => {
      if (!prev) return prev;
      const updated: any = { ...prev, is_liked: desiredLiked };
      if (prev.kind === 'listing') {
        updated.like_count = currentLikeCount + (desiredLiked ? 1 : -1);
      }
      return updated;
    });

    const { data, error } = await supabase.rpc('set_listing_like', {
      p_user_id: session.user.id,
      p_listing_id: listing.id,
      p_listing_type: listingType,
      p_liked: desiredLiked,
    });

    if (error || !data || data.length === 0) {
      console.error('Error setting like:', error);
      // Revert on failure
      setListing(prev => {
        if (!prev) return prev;
        const reverted: any = { ...prev, is_liked: currentIsLiked };
        if (prev.kind === 'listing') {
          reverted.like_count = currentLikeCount;
        }
        return reverted;
      });
      return;
    }

    // Reconcile from authoritative DB response
    const { is_liked, like_count } = data[0];
    setListing(prev => {
      if (!prev) return prev;
      const reconciled: any = { ...prev, is_liked };
      if (prev.kind === 'listing') {
        reconciled.like_count = like_count;
      }
      return reconciled;
    });

    // Write to store so Shop/Free can reconcile on focus
    setLikeUpdate({
      listingId: listing.id,
      listingType: listingType,
      isLiked: is_liked,
      likeCount: like_count,
    });
  };

  const handleContactSeller = async () => {
    if (!session?.user?.id) {
      router.push('/login');
      return;
    }
    if (!listing || isOwnListing) return;

    setContactingSeller(true);
    try {
      // Check for existing conversation first
      const listingType = listing.kind === 'listing' ? 'listing' : 'buy_nothing';
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('listing_type', listingType)
        .eq('buyer_id', session.user.id)
        .maybeSingle();

      if (existing?.id) {
        // Existing conversation — navigate directly to it
        router.push({
          pathname: '/conversation/[id]',
          params: { id: existing.id },
        });
      } else {
        // No existing conversation — navigate with new params
        router.push({
          pathname: '/conversation/[id]',
          params: {
            id: 'new',
            listing_id: listing.id,
            listing_type: listingType,
            seller_id: listing.seller.id,
            listing_title: listing.title,
            listing_cover_photo_url: listing.cover_photo_url || '',
            listing_price: listing.kind === 'listing' ? String(listing.price) : '',
            listing_status: listing.status,
          },
        });
      }
    } catch (err) {
      console.error('Error checking conversation:', err);
      // Fall back to new conversation on error
      router.push({
        pathname: '/conversation/[id]',
        params: {
          id: 'new',
          listing_id: listing.id,
          listing_type: listing.kind === 'listing' ? 'listing' : 'buy_nothing',
          seller_id: listing.seller.id,
          listing_title: listing.title,
          listing_cover_photo_url: listing.cover_photo_url || '',
          listing_price: listing.kind === 'listing' ? String(listing.price) : '',
          listing_status: listing.status,
        },
      });
    } finally {
      setContactingSeller(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !listing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Listing not found</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const sellerInitials = `${listing.seller.first_name.charAt(0)}${listing.seller.last_name.charAt(0)}`;
  const isVerified =
    listing.seller.verification_status === 'id_verified' ||
    listing.seller.verification_status === 'background_checked';
  const isOwnListing = !!session?.user?.id && session.user.id === listing?.seller?.id;
  const canGoBack = router.canGoBack();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Photo Carousel */}
      <View style={styles.carouselContainer}>
        <FlatList
          data={listing.media}
          renderItem={({ item }) => <CarouselItem item={item} />}
          keyExtractor={(item) => item.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
        />

        {/* Pagination Dots */}
        {listing.media.length > 1 && (
          <View style={styles.paginationContainer}>
            {listing.media.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.paginationDot,
                  index === currentImageIndex && styles.paginationDotActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Floating Back Button */}
        <TouchableOpacity
          style={[styles.floatingButton, styles.floatingBackButton, { top: insets.top }]}
          onPress={() => {
            if (canGoBack) {
              router.back();
            } else {
              router.replace('/(tabs)/shop');
            }
          }}
        >
          <Ionicons
            name={canGoBack ? 'arrow-back' : 'checkmark'}
            size={22}
            color="#1A1A1A"
          />
        </TouchableOpacity>

        {/* Floating Heart Button */}
        {!isOwnListing && (
          <TouchableOpacity
            style={[styles.floatingButton, styles.floatingHeartButton, { top: insets.top }]}
            onPress={handleToggleLike}
          >
            <Ionicons
              name={listing.is_liked ? 'heart' : 'heart-outline'}
              size={20}
              color={listing.is_liked ? '#FF5A5F' : '#CCCCCC'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Scrollable Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Title and Price */}
        <View style={styles.titlePriceRow}>
          <Text style={styles.title}>{listing.title}</Text>
          <View style={styles.priceAndStatusRow}>
            {listing.kind === 'listing' ? (
              <Text style={styles.price}>{formatPrice(listing.price)}</Text>
            ) : (
              <View style={styles.freeBadge}>
                <Text style={styles.freeText}>FREE</Text>
              </View>
            )}
            {listing.status === 'pending' && (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingPillText}>Pending</Text>
              </View>
            )}
          </View>
        </View>

        {/* Category and Condition */}
        <View style={styles.categoryConditionRow}>
          <Text style={styles.categoryConditionText}>
            {(listing.category_name ?? 'Uncategorised').toUpperCase()} • {formatCondition(listing.condition).toUpperCase()}
          </Text>
        </View>

        <View style={styles.divider} />

        {/* Description Section */}
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <Text style={styles.descriptionText}>{listing.description}</Text>

        <View style={styles.divider} />

        {/* Seller Section */}
        <Text style={styles.sectionLabel}>SELLER</Text>
        <View style={styles.sellerRow}>
          <View style={styles.avatar}>
            {listing.seller.avatar_url ? (
              <Image source={{ uri: listing.seller.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>{sellerInitials}</Text>
              </View>
            )}
          </View>
          <View style={styles.sellerInfo}>
            <Text style={styles.sellerName}>
              {listing.seller?.first_name} {listing.seller?.last_name?.charAt(0)}.
            </Text>
            <Text style={styles.sellerMeta}>
              {isVerified && 'Verified Parent • '}
              {listing.seller.location_label}
            </Text>
          </View>
          <View style={styles.ratingPlaceholder}>
            <Ionicons name="star-outline" size={14} color="#CCCCCC" />
            <Text style={styles.ratingText}>—</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Pickup Location Section */}
        <Text style={styles.sectionLabel}>PICKUP LOCATION</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#A4C8D8" />
          <Text style={styles.locationText}>{listing.location_label}</Text>
        </View>

        <View style={styles.divider} />

        {/* Details Section */}
        <Text style={styles.sectionLabel}>DETAILS</Text>
        <View style={styles.detailsContainer}>
          {listing.brand_name && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Brand</Text>
              <Text style={styles.detailValue}>{listing.brand_name}</Text>
            </View>
          )}

          {listing.kind === 'listing' && listing.payment_methods.length > 0 && (
            <View style={styles.paymentMethodsContainer}>
              <Text style={styles.detailLabel}>Accepted payments</Text>
              <View style={styles.paymentPills}>
                {listing.payment_methods.map((method, index) => (
                  <View key={index} style={styles.paymentPill}>
                    <Text style={styles.paymentPillText}>{method}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {Object.entries(listing.attributes).map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{humanizeKey(key)}</Text>
              <Text style={styles.detailValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Report Listing Link */}
        <TouchableOpacity onPress={handleReportListing}>
          <Text style={styles.reportLink}>Report listing</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Bar */}
      <View style={[styles.bottomBar, { paddingBottom: 12 + insets.bottom }]}>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>
        {isOwnListing ? (
          <View style={styles.actionBar}>
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              disabled={true}
            >
              <Text style={styles.editButtonText}>Edit Listing</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.messageSellerButton}
            onPress={handleContactSeller}
            disabled={contactingSeller}
          >
            {contactingSeller ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={18} color="#ffffff" />
                <Text style={styles.messageSellerText}>Message Seller</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  carouselContainer: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#F0F0F0',
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  paginationDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  floatingButton: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBackButton: {
    left: 16,
  },
  floatingHeartButton: {
    right: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  titlePriceRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 12,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
    color: '#A4C8D8',
    flexShrink: 0,
  },
  freeBadge: {
    backgroundColor: '#A4C8D8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  freeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  categoryConditionRow: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  categoryConditionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.3,
  },
  priceAndStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pendingPill: {
    backgroundColor: '#FFF3E0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingPillText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#FF9500',
  },
  divider: {
    height: 8,
    backgroundColor: '#F7F7F7',
    marginHorizontal: 0,
  },
  sectionLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sellerRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    width: '100%',
    height: '100%',
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  sellerInfo: {
    flex: 1,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sellerMeta: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  ratingPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  locationRow: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  descriptionText: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    fontSize: 15,
    color: '#444444',
    lineHeight: 22,
  },
  detailsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  detailRow: {
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 13,
    color: '#999999',
  },
  detailValue: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  paymentMethodsContainer: {
    paddingVertical: 4,
  },
  paymentPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  paymentPill: {
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paymentPillText: {
    fontSize: 13,
    color: '#1A1A1A',
  },
  reportLink: {
    fontSize: 13,
    color: '#CCCCCC',
    textDecorationLine: 'underline',
    textAlign: 'center',
    paddingVertical: 8,
  },
  bottomBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingTop: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  shareButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBar: {
    flex: 1,
  },
  actionButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#F0F0F0',
    flex: 1,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999999',
    textAlign: 'center',
  },
  messageSellerButton: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#A4C8D8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  messageSellerText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
