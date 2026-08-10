import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';

type PublicProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  location_label: string | null;
  created_at: string;
  avg_rating: number | null;
  rating_count: number;
  bio: Record<string, string>;
  total_listings: number;
  total_sold: number;
};

type ProfileQuestion = {
  question_key: string;
  prompt_text: string;
  sort_order: number;
};

type PublicListing = {
  id: string;
  listing_type: 'listing' | 'buy_nothing';
  title: string;
  price: number | null;
  cover_photo_url: string | null;
  status: string;
  condition: string;
  distance_meters: number | null;
};

type PublicRating = {
  id: string;
  listing_id: string;
  listing_type: string;
  listing_title: string;
  listing_cover_photo_url: string | null;
  role: 'seller' | 'buyer';
  rating: number;
  tags: string[];
  comment: string | null;
  rated_at: string;
  rater_id: string;
  rater_first_name: string;
  rater_avatar_url: string | null;
};

function formatCondition(condition: string): string {
  const conditionMap: Record<string, string> = {
    new_unopened: 'New (Unopened)',
    like_new: 'Like New',
    gently_used: 'Gently Used',
    used: 'Used',
  };
  return conditionMap[condition] || condition;
}

function formatMemberSince(createdAt: string): string {
  const date = new Date(createdAt);
  return `Member since ${date.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })}`;
}

function initialsOf(first: string, last: string): string {
  const f = (first || '').trim().charAt(0);
  const l = (last || '').trim().charAt(0);
  return `${f}${l}`.toUpperCase() || '?';
}

export default function PublicSellerProfile() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [questions, setQuestions] = useState<ProfileQuestion[]>([]);
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [ratings, setRatings] = useState<PublicRating[]>([]);
  const [activeTab, setActiveTab] = useState<'ratings' | 'listings' | 'bio'>('ratings');
  const [ratingSort, setRatingSort] = useState<
    'newest' | 'highest' | 'lowest'
  >('newest');
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select(
          `id, first_name, last_name, avatar_url,
           location_label, created_at, avg_rating,
           rating_count, bio, total_listings, total_sold`
        )
        .eq('id', id)
        .single();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProfile({
        ...data,
        bio: (data as any).bio || {},
      } as PublicProfile);
      setLoading(false);
    };

    const fetchQuestions = async () => {
      const { data } = await supabase
        .from('profile_questions')
        .select('question_key, prompt_text, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setQuestions(data);
    };

    const fetchListings = async () => {
      const { data, error } = await supabase.rpc('get_seller_listings', {
        p_seller_id: id,
        p_user_id: session?.user?.id || null,
      });
      if (error) {
        console.error('Error fetching seller listings:', error);
        return;
      }
      setListings(data || []);
    };

    const fetchRatings = async () => {
      if (!id) return;
      const { data, error } = await supabase.rpc('get_public_ratings', {
        p_user_id: id,
        p_limit: 20,
      });
      if (!error && data) setRatings(data);
    };

    fetchProfile();
    fetchQuestions();
    fetchListings();
    fetchRatings();
  }, [id, session?.user?.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity
          style={[styles.floatingBack, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.loadingFull}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      </SafeAreaView>
    );
  }

  if (notFound || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <TouchableOpacity
          style={[styles.floatingBack, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={styles.notFoundState}>
          <Ionicons name="person-outline" size={48} color="#CCCCCC" />
          <Text style={styles.notFoundTitle}>Profile not found</Text>
          <TouchableOpacity
            style={styles.notFoundButton}
            onPress={() => router.back()}
          >
            <Text style={styles.notFoundButtonText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fullName = `${profile.first_name} ${profile.last_name}`.trim();
  const initials = initialsOf(profile.first_name, profile.last_name);

  const answeredQuestions = questions.filter(
    (q) => profile.bio[q.question_key] && profile.bio[q.question_key].trim()
  );

  const sortedRatings = [...ratings].sort((a, b) => {
    if (ratingSort === 'newest') {
      return new Date(b.rated_at).getTime() - new Date(a.rated_at).getTime();
    } else if (ratingSort === 'highest') {
      return b.rating - a.rating;
    } else {
      return a.rating - b.rating;
    }
  });

  const openListing = (listing: PublicListing) => {
    if (listing.listing_type === 'buy_nothing') {
      router.push(`/listing/${listing.id}?type=buy_nothing`);
    } else {
      router.push(`/listing/${listing.id}`);
    }
  };

  const formatRatingDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  };

  const tagLabels: Record<string, string> = {
    friendly: 'Friendly',
    reliable: 'Reliable',
    on_time: 'On Time',
    responsive: 'Responsive',
    item_as_described: 'Item as Described',
  };

  const renderListingCard = (listing: PublicListing) => {
    const distanceMiles =
      listing.distance_meters !== null && listing.distance_meters !== undefined
        ? (listing.distance_meters / 1609.34).toFixed(1)
        : null;

    return (
      <TouchableOpacity
        key={`${listing.listing_type}_${listing.id}`}
        onPress={() => openListing(listing)}
        activeOpacity={0.85}
      >
        <View style={styles.listingCard}>
          <View style={styles.photoContainer}>
            {listing.cover_photo_url ? (
              <Image
                source={{ uri: listing.cover_photo_url }}
                style={styles.photo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="image-outline" size={28} color="#CCCCCC" />
              </View>
            )}
            {listing.status === 'pending' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
            <View
              style={[
                styles.priceBadge,
                listing.listing_type === 'buy_nothing' && styles.priceBadgeFree,
              ]}
            >
              <Text
                style={[
                  styles.priceText,
                  listing.listing_type === 'buy_nothing' && styles.priceTextFree,
                ]}
              >
                {listing.listing_type === 'buy_nothing'
                  ? 'Free'
                  : `$${(listing.price ?? 0).toFixed(2)}`}
              </Text>
            </View>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {listing.title}
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.conditionText} numberOfLines={1}>
                {formatCondition(listing.condition).toUpperCase()}
              </Text>
              {distanceMiles !== null && (
                <View style={styles.distanceContainer}>
                  <Ionicons
                    name="location-outline"
                    size={11}
                    color="#A4C8D8"
                  />
                  <Text style={styles.distanceText}>{distanceMiles} mi</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Floating back button */}
      <TouchableOpacity
        style={[styles.floatingBack, { top: insets.top + 12 }]}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
      </TouchableOpacity>

      {/* Profile header — not scrollable */}
      <ScrollView
        style={styles.headerScroll}
        scrollEnabled={false}
      >
        <View style={styles.profileSection}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          <Text style={styles.name}>{fullName}</Text>

          {profile.location_label ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color="#A4C8D8" />
              <Text style={styles.locationText}>{profile.location_label}</Text>
            </View>
          ) : null}

          <Text style={styles.memberSince}>
            {formatMemberSince(profile.created_at)}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.total_listings}</Text>
              <Text style={styles.statLabel}>LISTINGS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.total_sold}</Text>
              <Text style={styles.statLabel}>SOLD & GIVEN</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statColumn}>
              <Text style={styles.statValue}>{profile.rating_count}</Text>
              <Text style={styles.statLabel}>RATINGS</Text>
            </View>
          </View>

          {profile.rating_count > 0 ? (
            <View style={styles.ratingsRow}>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Ionicons
                    key={s}
                    name={
                      s <= Math.round(profile.avg_rating ?? 0)
                        ? 'star'
                        : 'star-outline'
                    }
                    size={16}
                    color="#FFB800"
                  />
                ))}
              </View>
              <Text style={styles.ratingAvg}>
                {profile.avg_rating?.toFixed(1)}
              </Text>
              <Text style={styles.ratingCount}>
                ({profile.rating_count})
              </Text>
            </View>
          ) : (
            <Text style={styles.ratingNone}>No ratings yet</Text>
          )}
        </View>
      </ScrollView>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        {(['ratings', 'listings', 'bio'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={styles.tabItem}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab && styles.tabLabelActive,
              ]}
              numberOfLines={1}
            >
              {tab === 'ratings'
                ? 'Ratings'
                : tab === 'listings'
                ? 'Active Listings'
                : 'Bio'}
            </Text>
            {activeTab === tab && (
              <View style={styles.tabUnderline} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Tab content */}
      {activeTab === 'ratings' && (
        <FlatList
          data={sortedRatings}
          keyExtractor={(item) => item.id}
          style={[styles.tabContent, { backgroundColor: '#FFFFFF' }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.sortPillsRow}>
              {(['newest', 'highest', 'lowest'] as const).map((sort) => (
                <TouchableOpacity
                  key={sort}
                  style={[
                    styles.sortPill,
                    ratingSort === sort && styles.sortPillActive,
                  ]}
                  onPress={() => setRatingSort(sort)}
                >
                  <Text
                    style={[
                      styles.sortPillText,
                      ratingSort === sort && styles.sortPillTextActive,
                    ]}
                  >
                    {sort.charAt(0).toUpperCase() + sort.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="star-outline" size={40} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No ratings yet</Text>
            </View>
          }
          ItemSeparatorComponent={() => (
            <View style={styles.ratingDivider} />
          )}
          renderItem={({ item: r }) => (
            <View style={styles.ratingRow}>
              <View style={styles.ratingRowInner}>
                <View style={styles.ratingRowLeft}>
                  {/* Reviewer name + avatar */}
                  <View style={styles.raterHeaderRow}>
                    {r.rater_avatar_url ? (
                      <Image
                        source={{ uri: r.rater_avatar_url }}
                        style={styles.raterAvatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.raterAvatar,
                          styles.raterAvatarPlaceholder,
                        ]}
                      >
                        <Text style={styles.raterInitial}>
                          {r.rater_first_name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.raterName}>
                      {r.rater_first_name}
                    </Text>
                  </View>

                  {/* Stars + role + date + type icon */}
                  <View style={styles.ratingMetaRow}>
                    <View style={styles.ratingStarsRow}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Ionicons
                          key={s}
                          name={s <= r.rating ? 'star' : 'star-outline'}
                          size={13}
                          color="#FFB800"
                        />
                      ))}
                    </View>
                    <Text style={styles.ratingMeta}>
                      {r.role === 'seller' ? 'Seller' : 'Buyer'} ·{' '}
                      {formatRatingDate(r.rated_at)}
                    </Text>
                    <View style={styles.ratingTypeCluster}>
                      <Text style={styles.ratingMeta}>·</Text>
                      <Ionicons
                        name={
                          r.listing_type === 'buy_nothing'
                            ? 'gift-outline'
                            : 'bag-outline'
                        }
                        size={12}
                        color="#999999"
                      />
                    </View>
                  </View>

                  {/* Comment */}
                  {r.comment ? (
                    <Text style={styles.ratingComment}>"{r.comment}"</Text>
                  ) : null}

                  {/* Tags */}
                  {r.tags && r.tags.length > 0 && (
                    <View style={styles.ratingTagsRow}>
                      {r.tags.map((tag) => (
                        <View key={tag} style={styles.ratingTagPill}>
                          <Text style={styles.ratingTagText}>
                            {tagLabels[tag] || tag}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Listing thumbnail */}
                <TouchableOpacity
                  style={styles.ratingThumbButton}
                  onPress={() => openListing({
                    id: r.listing_id,
                    listing_type: r.listing_type as 'listing' | 'buy_nothing',
                    title: r.listing_title,
                    price: null,
                    cover_photo_url: r.listing_cover_photo_url,
                    status: 'sold',
                    condition: '',
                    distance_meters: null,
                  })}
                  activeOpacity={0.7}
                >
                  {r.listing_cover_photo_url ? (
                    <Image
                      source={{ uri: r.listing_cover_photo_url }}
                      style={styles.ratingThumb}
                    />
                  ) : (
                    <View style={styles.ratingThumbPlaceholder} />
                  )}
                  <Ionicons
                    name="chevron-forward"
                    size={12}
                    color="#CCCCCC"
                    style={styles.ratingThumbChevron}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {activeTab === 'listings' && (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          style={styles.tabContent}
          contentContainerStyle={styles.tabContentPad}
          showsVerticalScrollIndicator={false}
          columnWrapperStyle={{ gap: 8 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="bag-outline" size={40} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No active listings</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.gridCell}>
              {renderListingCard(item)}
            </View>
          )}
        />
      )}

      {activeTab === 'bio' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.tabContentPad}
          showsVerticalScrollIndicator={false}
        >
          {answeredQuestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={40} color="#CCCCCC" />
              <Text style={styles.emptyStateText}>No bio yet</Text>
            </View>
          ) : (
            answeredQuestions.map((q) => (
              <View key={q.question_key} style={styles.bioBlock}>
                <Text style={styles.questionPrompt}>{q.prompt_text}</Text>
                <Text style={styles.answerText}>
                  {profile.bio[q.question_key]}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Floating back button ──────────────────────────────────
  floatingBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Profile header ───────────────────────────────────────
  headerScroll: {
    flexGrow: 0,
  },
  profileSection: {
    paddingHorizontal: 16,
    paddingTop: 72,
    paddingBottom: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 28,
    color: '#FFFFFF',
  },
  name: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  memberSince: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#CCCCCC',
    marginTop: 4,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    paddingVertical: 12,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 14,
  },
  statColumn: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  statLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 10,
    color: '#999999',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statDivider: {
    width: 0.5,
    height: 28,
    backgroundColor: '#E0E0E0',
    alignSelf: 'center',
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingAvg: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    color: '#1A1A1A',
  },
  ratingCount: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  ratingNone: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#CCCCCC',
  },

  // ─── Tab bar ──────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  tabLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },
  tabLabelActive: {
    fontFamily: 'Quicksand_700Bold',
    color: '#1A1A1A',
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 8,
    right: 8,
    height: 2,
    backgroundColor: '#A4C8D8',
    borderRadius: 1,
  },

  // ─── Sort pills ──────────────────────────────────────────
  sortPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  sortPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  sortPillActive: {
    backgroundColor: '#A4C8D8',
    borderColor: '#A4C8D8',
  },
  sortPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  sortPillTextActive: {
    fontFamily: 'Quicksand_700Bold',
    color: '#FFFFFF',
  },

  // ─── Divider ─────────────────────────────────────────────
  divider: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
  },

  // ─── Tab content ─────────────────────────────────────────
  tabContent: {
    flex: 1,
  },
  tabContentPad: {
    padding: 16,
    paddingBottom: 40,
  },

  // ─── Empty state ─────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingTop: 48,
    gap: 12,
  },
  emptyStateText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#999999',
  },

  // ─── Rating row (continuous list) ───────────────────────
  ratingRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  raterHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  raterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  raterAvatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  raterInitial: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  raterName: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
  },
  ratingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ratingStarsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingMeta: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },
  ratingTypeCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingComment: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
    marginBottom: 10,
    fontStyle: 'italic',
  },
  ratingTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  ratingTagPill: {
    backgroundColor: '#F0F9FC',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 0.5,
    borderColor: '#A4C8D8',
  },
  ratingTagText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#A4C8D8',
  },
  ratingRowInner: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  ratingRowLeft: {
    flex: 1,
  },
  ratingThumbButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  ratingThumb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    opacity: 0.9,
  },
  ratingThumbPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingThumbChevron: {},
  ratingDivider: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 16,
  },

  // ─── Bio ─────────────────────────────────────────────────
  bioBlock: {
    marginBottom: 20,
  },
  questionPrompt: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  answerText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
  },

  // ─── Listings grid ────────────────────────────────────────
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridCell: {
    flex: 1,
  },
  listingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF9500',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pendingText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  priceBadgeFree: {
    backgroundColor: '#A4C8D8',
  },
  priceText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#1A1A1A',
  },
  priceTextFree: {
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 8,
  },
  listingTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#1A1A1A',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conditionText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 10,
    color: '#999999',
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 10,
    color: '#A4C8D8',
  },

  // ─── Not found ───────────────────────────────────────────
  notFoundState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  notFoundTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  notFoundButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  notFoundButtonText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
