import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
  Modal,
  ScrollView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';

type Listing = {
  id: string;
  title: string;
  price: number;
  cover_photo_url: string;
  category_name: string;
  distance_meters: number;
  created_at: string;
  condition: string;
  is_featured?: boolean;
};

const CONDITIONS = [
  { label: 'New (unopened)', value: 'new_unopened' },
  { label: 'Like new', value: 'like_new' },
  { label: 'Gently used', value: 'gently_used' },
  { label: 'Used', value: 'used' },
];

const CATEGORIES = [
  { label: 'All', slug: null },
  { label: 'Clothes', slug: 'clothes' },
  { label: 'Gear', slug: 'gear' },
  { label: 'Toys', slug: 'toys' },
];

const RADIUS_OPTIONS = [
  { label: '5 mi', meters: 8047 },
  { label: '10 mi', meters: 16093 },
  { label: '25 mi', meters: 40234 },
  { label: '50 mi', meters: 80467 },
];

const USER_LAT = 33.1972;
const USER_LNG = -96.6397;
const PAGE_SIZE = 20;

function formatCondition(condition: string): string {
  const conditionMap: Record<string, string> = {
    new_unopened: 'New (Unopened)',
    like_new: 'Like New',
    gently_used: 'Gently Used',
    used: 'Used',
  };
  return conditionMap[condition] || condition;
}

function SkeletonCard() {
  const shimmerValue = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1.0,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0.4,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerValue]);

  return (
    <View style={styles.skeletonCard}>
      <Animated.View
        style={[
          styles.skeletonPhoto,
          { opacity: shimmerValue },
        ]}
      />
      <View style={styles.skeletonBody}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity: shimmerValue },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonMeta,
            { opacity: shimmerValue },
          ]}
        />
      </View>
    </View>
  );
}

function SkeletonGrid() {
  const skeletonData = Array.from({ length: 6 }, (_, i) => ({ id: `skeleton-${i}` }));

  return (
    <FlatList
      data={skeletonData}
      renderItem={() => <SkeletonCard />}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={styles.columnWrapper}
      contentContainerStyle={styles.listContent}
      scrollEnabled={false}
    />
  );
}

function ListingCard({ listing }: { listing: Listing }) {
  const router = useRouter();
  const priceFormatted = listing.price.toFixed(2);
  const distanceMiles = (listing.distance_meters / 1609.34).toFixed(1);

  return (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => router.push(`/listing/${listing.id}`)}
    >
      <View style={styles.photoContainer}>
        <Image
          source={{ uri: listing.cover_photo_url }}
          style={styles.photo}
          resizeMode="cover"
        />
        <View style={styles.priceBadge}>
          <Text style={styles.priceText}>${priceFormatted}</Text>
        </View>
        <View style={styles.heartButton}>
          <Ionicons name="heart-outline" size={18} color="#CCCCCC" />
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.listingTitle} numberOfLines={1}>
          {listing.title}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.conditionText}>
            {formatCondition(listing.condition).toUpperCase()}
          </Text>
          <View style={styles.distanceContainer}>
            <Ionicons name="location-outline" size={11} color="#A4C8D8" />
            <Text style={styles.distanceText}>{distanceMiles} mi</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function Shop() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingsLengthRef = useRef<number>(0);

  // Filter - Active state (used by fetchListings)
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [activeMinPrice, setActiveMinPrice] = useState(0);
  const [activeMaxPrice, setActiveMaxPrice] = useState(500);
  const [activeRadius, setActiveRadius] = useState(80467);

  // Filter - Pending state (used by modal UI only)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [pendingConditions, setPendingConditions] = useState<string[]>([]);
  const [pendingMinPrice, setPendingMinPrice] = useState(0);
  const [pendingMaxPrice, setPendingMaxPrice] = useState(500);
  const [pendingRadius, setPendingRadius] = useState(80467);

  // Keep listingsLengthRef in sync with listings.length
  useEffect(() => {
    listingsLengthRef.current = listings.length;
  }, [listings]);

  const fetchListings = useCallback(
    async (pageCursor?: string) => {
      try {
        const isInitialLoad = !pageCursor && listingsLengthRef.current === 0;
        const isRefetch = !pageCursor && listingsLengthRef.current > 0;

        if (isInitialLoad) {
          setLoading(true);
        } else if (isRefetch) {
          setIsRefreshing(true);
        } else {
          setLoadingMore(true);
        }

        const { data, error } = await supabase.rpc('get_shop_feed', {
          user_lat: USER_LAT,
          user_lng: USER_LNG,
          user_id: null,
          radius_meters: activeRadius,
          category_slug: activeCategory,
          search_query: searchQuery || null,
          condition_filter: activeConditions.length > 0 ? activeConditions[0] : null,
          min_price: activeMinPrice,
          max_price: activeMaxPrice,
          page_size: PAGE_SIZE,
          page_cursor: pageCursor || null,
        });

        if (error) {
          console.error('Error fetching listings:', error);
          return;
        }

        const newListings = data || [];

        if (isInitialLoad || isRefetch) {
          setListings(newListings);
        } else {
          setListings((prev) => [...prev, ...newListings]);
        }

        setHasMore(newListings.length === PAGE_SIZE);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, activeCategory, activeConditions, activeMinPrice, activeMaxPrice, activeRadius]
  );

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || listings.length === 0) return;

    const lastListing = listings[listings.length - 1];
    fetchListings(lastListing.created_at);
  };

  const handleSearchChange = (text: string) => {
    setSearchInput(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchQuery(text);
    }, 800);
  };

  const handleConditionToggle = (value: string) => {
    setPendingConditions((prev) =>
      prev.includes(value) ? prev.filter((c) => c !== value) : [...prev, value]
    );
  };

  const handleResetFilters = () => {
    setPendingCategory(null);
    setPendingConditions([]);
    setPendingMinPrice(0);
    setPendingMaxPrice(500);
    setPendingRadius(80467);
  };

  const handleApplyFilters = () => {
    setActiveCategory(pendingCategory);
    setActiveConditions(pendingConditions);
    setActiveMinPrice(pendingMinPrice);
    setActiveMaxPrice(pendingMaxPrice);
    setActiveRadius(pendingRadius);
    setFilterVisible(false);
  };

  const handleOpenFilter = () => {
    // Sync pending state from active state when modal opens
    setPendingCategory(activeCategory);
    setPendingConditions(activeConditions);
    setPendingMinPrice(activeMinPrice);
    setPendingMaxPrice(activeMaxPrice);
    setPendingRadius(activeRadius);
    setFilterVisible(true);
  };

  // Computed value for filter indicator
  const hasActiveFilters =
    activeCategory !== null ||
    activeConditions.length > 0 ||
    activeMinPrice > 0 ||
    activeMaxPrice < 500 ||
    activeRadius !== 80467;

  const renderListingCard = ({ item }: { item: Listing }) => (
    <ListingCard listing={item} />
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="search-outline" size={48} color="#CCCCCC" />
      <Text style={styles.emptyStateTitle}>No listings found</Text>
      <Text style={styles.emptyStateSubtitle}>Try adjusting your filters or search</Text>
    </View>
  );

  if (loading && listings.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="bag-outline" size={31} color="#A4C8D8" />
          <Text style={styles.wordmark}>Babyly</Text>
        </View>
        <TouchableOpacity onPress={() => {}}>
          <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search-outline" size={18} color="#AAAAAA" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for clothes, toys..."
            placeholderTextColor="#AAAAAA"
            value={searchInput}
            onChangeText={handleSearchChange}
          />
          {searchInput !== '' && (
            <TouchableOpacity
              onPress={() => {
                setSearchInput('');
                setSearchQuery('');
              }}
            >
              <Ionicons name="close-circle" size={18} color="#AAAAAA" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Location + Filter Row */}
      <View style={styles.locationFilterRow}>
        <TouchableOpacity style={styles.locationPill} onPress={() => {}}>
          <Ionicons name="location-outline" size={15} color="#A4C8D8" />
          <Text style={styles.locationText}>McKinney, TX • 10 mi</Text>
          <Ionicons name="chevron-down" size={14} color="#999999" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterButton} onPress={handleOpenFilter}>
          <Ionicons name="options-outline" size={20} color="#1A1A1A" />
          {hasActiveFilters && <View style={styles.filterIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Listing Grid, Skeleton Grid, or Empty State */}
      {isRefreshing ? (
        <SkeletonGrid />
      ) : listings.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={listings}
          renderItem={renderListingCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#A4C8D8" />
              </View>
            ) : null
          }
        />
      )}

      {/* Filter Modal */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFilterVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={styles.resetButton}>Reset</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter</Text>
            <TouchableOpacity onPress={() => setFilterVisible(false)}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView>
            {/* Category Section */}
            <Text style={styles.sectionLabel}>CATEGORY</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((category) => {
                const isSelected = category.slug === pendingCategory;
                return (
                  <TouchableOpacity
                    key={category.slug || 'all'}
                    style={[
                      styles.categoryPill,
                      isSelected && styles.categoryPillSelected,
                    ]}
                    onPress={() => setPendingCategory(category.slug)}
                  >
                    <Text
                      style={[
                        styles.categoryPillText,
                        isSelected && styles.categoryPillTextSelected,
                      ]}
                    >
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.divider} />

            {/* Condition Section */}
            <Text style={styles.sectionLabel}>CONDITION</Text>
            {CONDITIONS.map((condition) => {
              const isSelected = pendingConditions.includes(condition.value);
              return (
                <TouchableOpacity
                  key={condition.value}
                  style={styles.conditionRow}
                  onPress={() => handleConditionToggle(condition.value)}
                >
                  <Text style={styles.conditionLabel}>{condition.label}</Text>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.divider} />

            {/* Price Range Section */}
            <View style={styles.priceHeader}>
              <Text style={styles.sectionLabel}>PRICE RANGE</Text>
              <Text style={styles.priceRange}>
                ${pendingMinPrice} — ${pendingMaxPrice}
              </Text>
            </View>
            <View style={styles.priceInputRow}>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceInputLabel}>Min</Text>
                <TextInput
                  style={styles.priceInput}
                  value={pendingMinPrice.toString()}
                  onChangeText={(text) => setPendingMinPrice(Number(text) || 0)}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.priceInputContainer}>
                <Text style={styles.priceInputLabel}>Max</Text>
                <TextInput
                  style={styles.priceInput}
                  value={pendingMaxPrice.toString()}
                  onChangeText={(text) => setPendingMaxPrice(Number(text) || 0)}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.divider} />

            {/* Distance Section */}
            <Text style={styles.sectionLabel}>DISTANCE</Text>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map((option) => {
                const isSelected = pendingRadius === option.meters;
                return (
                  <TouchableOpacity
                    key={option.meters}
                    style={[
                      styles.radiusPill,
                      isSelected && styles.radiusPillSelected,
                    ]}
                    onPress={() => setPendingRadius(option.meters)}
                  >
                    <Text
                      style={[
                        styles.radiusPillText,
                        isSelected && styles.radiusPillTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          {/* Show Results Button */}
          <TouchableOpacity
            style={styles.showResultsButton}
            onPress={handleApplyFilters}
          >
            <Text style={styles.showResultsText}>Show Results</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 28,
    color: '#A4C8D8',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  locationFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
    alignItems: 'center',
  },
  locationPill: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A1A',
    flex: 1,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterIndicator: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A4C8D8',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 20,
  },
  columnWrapper: {
    paddingHorizontal: 12,
  },
  skeletonCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  skeletonPhoto: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#EFEFEF',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  skeletonBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  skeletonTitle: {
    height: 14,
    borderRadius: 4,
    backgroundColor: '#EFEFEF',
    width: '80%',
  },
  skeletonMeta: {
    marginTop: 6,
    height: 11,
    borderRadius: 4,
    backgroundColor: '#EFEFEF',
    width: '55%',
  },
  listingCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 4,
    marginBottom: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F0F0F0',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  priceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  heartButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  conditionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.3,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distanceText: {
    fontSize: 11,
    color: '#999999',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999999',
    marginTop: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  resetButton: {
    fontSize: 15,
    color: '#A4C8D8',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 20,
  },
  categoryPill: {
    backgroundColor: 'transparent',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryPillSelected: {
    backgroundColor: '#A4C8D8',
    borderColor: '#A4C8D8',
  },
  categoryPillText: {
    fontSize: 14,
    color: '#666666',
  },
  categoryPillTextSelected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  conditionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  conditionLabel: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#A4C8D8',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginTop: 12,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  priceRange: {
    fontSize: 14,
    color: '#666666',
    paddingTop: 20,
    paddingBottom: 12,
  },
  priceInputRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 6,
  },
  priceInput: {
    backgroundColor: '#F7F7F7',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1A1A1A',
  },
  radiusRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 20,
  },
  radiusPill: {
    backgroundColor: 'transparent',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  radiusPillSelected: {
    backgroundColor: '#A4C8D8',
    borderColor: '#A4C8D8',
  },
  radiusPillText: {
    fontSize: 14,
    color: '#666666',
  },
  radiusPillTextSelected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  showResultsButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 32,
    paddingVertical: 16,
  },
  showResultsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
});
