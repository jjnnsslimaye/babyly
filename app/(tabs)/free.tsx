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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { consumeLikeUpdate } from '../../lib/likeStore';

type Listing = {
  id: string;
  title: string;
  cover_photo_url: string;
  category_name: string;
  distance_meters: number;
  created_at: string;
  condition: string;
  is_liked: boolean;
  seller_id: string;
  like_count: number;
  status: string;
};

type Category = {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  sort_order: number;
};

type CategoryAttribute = {
  category_id: string;
  attribute_key: string;
  attribute_value: string;
  sort_order: number;
};

type Brand = {
  id: string;
  name: string;
  slug: string;
};

const CONDITIONS = [
  { label: 'New (unopened)', value: 'new_unopened' },
  { label: 'Like new', value: 'like_new' },
  { label: 'Gently used', value: 'gently_used' },
  { label: 'Used', value: 'used' },
];

const RADIUS_OPTIONS = [
  { label: '5 mi', meters: 8047 },
  { label: '10 mi', meters: 16093 },
  { label: '25 mi', meters: 40234 },
  { label: '50 mi', meters: 80467 },
];

const STORAGE_KEY_LAT = 'babyly_user_lat';
const STORAGE_KEY_LNG = 'babyly_user_lng';
const STORAGE_KEY_LABEL = 'babyly_location_label';
const STORAGE_KEY_RADIUS = 'babyly_radius_meters';

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ',
  'Arkansas': 'AR', 'California': 'CA', 'Colorado': 'CO',
  'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL',
  'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
  'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA',
  'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
  'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
  'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN',
  'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
  'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI',
  'Wyoming': 'WY', 'District of Columbia': 'DC',
};

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

function ListingCard({
  listing,
  session,
  onToggleLike,
}: {
  listing: Listing;
  session: any;
  onToggleLike: (id: string, isLiked: boolean, likeCount: number) => void;
}) {
  const router = useRouter();
  const distanceMiles = (listing.distance_meters / 1609.34).toFixed(1);

  return (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => router.push(`/listing/${listing.id}?type=buy_nothing`)}
    >
      <View style={styles.photoContainer}>
        <Image
          source={{ uri: listing.cover_photo_url }}
          style={styles.photo}
          resizeMode="cover"
        />
        <View style={styles.freeBadge}>
          <Text style={styles.freeText}>FREE</Text>
        </View>
        {listing.status === 'pending' && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingText}>Pending</Text>
          </View>
        )}
        {(!session?.user?.id || session.user.id !== listing.seller_id) && (
          <TouchableOpacity
            style={styles.heartButton}
            onPress={() =>
              onToggleLike(listing.id, listing.is_liked, listing.like_count)
            }
          >
            <Ionicons
              name={listing.is_liked ? 'heart' : 'heart-outline'}
              size={18}
              color={listing.is_liked ? '#FF5A5F' : '#CCCCCC'}
            />
          </TouchableOpacity>
        )}
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

export default function BuyNothing() {
  const { session } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Location
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState<string>('');
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // Search
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listingsLengthRef = useRef<number>(0);
  const filterAppliedRef = useRef(false);

  // Filter data loaded from DB
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Filter - Active state (used by fetchListings)
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<string | null>(null);
  const [activeAttributes, setActiveAttributes] = useState<Record<string, string>>({});
  const [activeConditions, setActiveConditions] = useState<string[]>([]);
  const [activeRadius, setActiveRadius] = useState(40234);

  // Filter - Pending state (used by modal UI only)
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const [pendingSubcategory, setPendingSubcategory] = useState<string | null>(null);
  const [pendingBrand, setPendingBrand] = useState<string | null>(null);
  const [pendingAttributes, setPendingAttributes] = useState<Record<string, string>>({});
  const [pendingConditions, setPendingConditions] = useState<string[]>([]);

  // Brand modal state
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');

  // Keep listingsLengthRef in sync with listings.length
  useEffect(() => {
    listingsLengthRef.current = listings.length;
  }, [listings]);

  // Initialize location on mount
  useEffect(() => {
    const initializeLocation = async () => {
      try {
        // 1. Check AsyncStorage first
        const storedLat = await AsyncStorage.getItem(STORAGE_KEY_LAT);
        const storedLng = await AsyncStorage.getItem(STORAGE_KEY_LNG);
        const storedLabel = await AsyncStorage.getItem(STORAGE_KEY_LABEL);
        const storedRadius = await AsyncStorage.getItem(STORAGE_KEY_RADIUS);

        if (storedLat && storedLng && storedLabel) {
          setUserLat(parseFloat(storedLat));
          setUserLng(parseFloat(storedLng));
          setLocationLabel(storedLabel);
          if (storedRadius) {
            setActiveRadius(parseInt(storedRadius, 10));
          }
          return;
        }

        // 2. No location found - leave null, empty state will prompt user
        setLoading(false);
      } catch (error) {
        console.error('Error initializing location:', error);
        setLoading(false);
      }
    };

    initializeLocation();
  }, [session?.user?.id]);

  const saveLocation = async (
    lat: number,
    lng: number,
    label: string,
    radius?: number
  ) => {
    setUserLat(lat);
    setUserLng(lng);
    setLocationLabel(label);
    await AsyncStorage.setItem(STORAGE_KEY_LAT, String(lat));
    await AsyncStorage.setItem(STORAGE_KEY_LNG, String(lng));
    await AsyncStorage.setItem(STORAGE_KEY_LABEL, label);
    if (radius !== undefined) {
      setActiveRadius(radius);
      await AsyncStorage.setItem(STORAGE_KEY_RADIUS, String(radius));
    }
  };

  const handleUseGPS = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setZipError('Location permission denied. Enter a ZIP code instead.');
        setLocationLoading(false);
        return;
      }
      const coords = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = coords.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const rawRegion = place?.region || '';
      const abbreviatedRegion =
        STATE_NAME_TO_ABBR[rawRegion] || rawRegion;
      const label = place
        ? `${place.city || place.district || ''}, ${abbreviatedRegion}`
            .trim()
            .replace(/^,|,$/g, '')
        : 'Current location';
      await saveLocation(latitude, longitude, label);
      setLocationSheetVisible(false);
    } catch (e) {
      setZipError('Could not get your location. Enter a ZIP code instead.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleZipSubmit = async () => {
    const zip = zipInput.trim();
    if (zip.length !== 5 || isNaN(Number(zip))) {
      setZipError('Please enter a valid 5-digit ZIP code.');
      return;
    }
    setZipLoading(true);
    setZipError('');
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
        { headers: { 'User-Agent': 'Babyly/1.0' } }
      );
      const geoData = await geoRes.json();
      if (!geoData || geoData.length === 0) {
        setZipError('ZIP code not found. Please try another.');
        setZipLoading(false);
        return;
      }
      const { lat, lon, display_name } = geoData[0];
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lon);
      const parts = display_name.split(',').map((p: string) => p.trim());
      const city = parts[1] || parts[0] || zip;
      const fullStateName = parts[3] || '';
      const state = STATE_NAME_TO_ABBR[fullStateName] || fullStateName;
      const label = state ? `${city}, ${state}` : city;
      await saveLocation(latitude, longitude, label);
      setLocationSheetVisible(false);
    } catch (e) {
      setZipError('Could not find that ZIP code. Please try again.');
    } finally {
      setZipLoading(false);
      setZipInput('');
    }
  };

  // Load filter data from DB
  const loadFilterData = async () => {
    const [catResult, attrResult, brandResult] = await Promise.all([
      supabase
        .from('categories')
        .select('id, parent_id, name, slug, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('category_attributes')
        .select('category_id, attribute_key, attribute_value, sort_order')
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('brands')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name'),
    ]);
    if (catResult.data) setCategories(catResult.data);
    if (attrResult.data) setCategoryAttributes(attrResult.data);
    if (brandResult.data) setBrands(brandResult.data);
  };

  useEffect(() => {
    loadFilterData();
  }, []);

  const fetchListings = useCallback(
    async (pageCursor?: string) => {
      if (userLat === null || userLng === null) return;

      try {
        const isInitialLoad = !pageCursor && listingsLengthRef.current === 0 && !filterAppliedRef.current;
        const isRefetch = !pageCursor && (listingsLengthRef.current > 0 || filterAppliedRef.current);

        // Reset the flag after reading it
        if (filterAppliedRef.current) {
          filterAppliedRef.current = false;
        }

        if (isInitialLoad) {
          setLoading(true);
        } else if (isRefetch) {
          setIsRefreshing(true);
        } else {
          setLoadingMore(true);
        }

        console.log('Fetching with brand_id:', activeBrand);

        const { data, error } = await supabase.rpc('get_buy_nothing_feed', {
          user_lat: userLat,
          user_lng: userLng,
          user_id: session?.user?.id || null,
          radius_meters: activeRadius,
          category_slug: activeSubcategory || activeCategory || null,
          brand_id: activeBrand || null,
          attribute_filters: Object.keys(activeAttributes).length > 0
            ? activeAttributes
            : null,
          search_query: searchQuery || null,
          condition_filter: activeConditions.length > 0 ? activeConditions[0] : null,
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
    [session, searchQuery, activeCategory, activeSubcategory, activeBrand, activeAttributes, activeConditions, activeRadius, userLat, userLng]
  );

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  // Pull-to-refresh — fetchListings() with no cursor sets/clears
  // isRefreshing internally, so we just delegate.
  const handleRefresh = useCallback(async () => {
    await fetchListings();
  }, [fetchListings]);

  useFocusEffect(
    useCallback(() => {
      const update = consumeLikeUpdate();
      if (update && update.listingType === 'buy_nothing') {
        setListings(prev =>
          prev.map(l =>
            l.id === update.listingId
              ? { ...l, is_liked: update.isLiked, like_count: update.likeCount }
              : l
          )
        );
      }
    }, [])
  );

  const handleToggleLike = async (
    listingId: string,
    currentIsLiked: boolean,
    currentLikeCount: number
  ) => {
    if (!session?.user?.id) {
      router.push('/login');
      return;
    }

    const desiredLiked = !currentIsLiked;

    // Optimistic update
    setListings(prev =>
      prev.map(l =>
        l.id === listingId
          ? {
              ...l,
              is_liked: desiredLiked,
              like_count: currentLikeCount + (desiredLiked ? 1 : -1),
            }
          : l
      )
    );

    const { data, error } = await supabase.rpc('set_listing_like', {
      p_user_id: session.user.id,
      p_listing_id: listingId,
      p_listing_type: 'buy_nothing',
      p_liked: desiredLiked,
    });

    if (error || !data || data.length === 0) {
      console.error('Error setting like:', error);
      // Revert on failure
      setListings(prev =>
        prev.map(l =>
          l.id === listingId
            ? { ...l, is_liked: currentIsLiked, like_count: currentLikeCount }
            : l
        )
      );
      return;
    }

    // Reconcile from authoritative DB response
    const { is_liked, like_count } = data[0];
    setListings(prev =>
      prev.map(l =>
        l.id === listingId
          ? { ...l, is_liked, like_count }
          : l
      )
    );
  };

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

  const handleResetFilters = () => {
    setPendingCategory(null);
    setPendingSubcategory(null);
    setPendingBrand(null);
    setPendingAttributes({});
    setPendingConditions([]);
  };

  const handleApplyFilters = async () => {
    filterAppliedRef.current = true;
    setListings([]);
    setActiveCategory(pendingCategory);
    setActiveSubcategory(pendingSubcategory);
    setActiveBrand(pendingBrand);
    setActiveAttributes(pendingAttributes);
    setActiveConditions(pendingConditions);
    setFilterVisible(false);
  };

  const handleOpenFilter = () => {
    // Sync pending state from active state when modal opens
    setPendingCategory(activeCategory);
    setPendingSubcategory(activeSubcategory);
    setPendingBrand(activeBrand);
    setPendingAttributes(activeAttributes);
    setPendingConditions(activeConditions);
    setFilterVisible(true);
  };

  // Computed value for filter indicator
  const hasActiveFilters =
    activeConditions.length > 0 ||
    activeCategory !== null ||
    activeSubcategory !== null ||
    activeBrand !== null ||
    Object.keys(activeAttributes).length > 0;

  const renderListingCard = ({ item }: { item: Listing }) => (
    <ListingCard
      listing={item}
      session={session}
      onToggleLike={handleToggleLike}
    />
  );

  const renderEmptyState = () => {
    if (userLat === null) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateTitle}>Where are you?</Text>
          <Text style={styles.emptyStateSubtitle}>
            Set your location to see listings near you
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => setLocationSheetVisible(true)}
          >
            <Text style={styles.emptyStateButtonText}>Set location</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color="#CCCCCC" />
        <Text style={styles.emptyStateTitle}>No free items found</Text>
        <Text style={styles.emptyStateSubtitle}>Try adjusting your filters or check back soon</Text>
      </View>
    );
  };

  // Derived data for filter modal
  const topLevelCategories = categories.filter((c) => c.parent_id === null);
  const selectedCategory = pendingSubcategory
    ? categories.find((c) => c.slug === pendingSubcategory)
    : categories.find((c) => c.slug === pendingCategory);
  const subcategories =
    pendingCategory === 'gear'
      ? categories.filter((c) => {
          const gearCat = categories.find((g) => g.slug === 'gear');
          return c.parent_id === gearCat?.id;
        })
      : [];

  const attributesForCategory = selectedCategory
    ? categoryAttributes.filter((attr) => attr.category_id === selectedCategory.id)
    : [];

  const attributeKeyGroups: Record<string, string[]> = {};
  attributesForCategory.forEach((attr) => {
    if (!attributeKeyGroups[attr.attribute_key]) {
      attributeKeyGroups[attr.attribute_key] = [];
    }
    if (!attributeKeyGroups[attr.attribute_key].includes(attr.attribute_value)) {
      attributeKeyGroups[attr.attribute_key].push(attr.attribute_value);
    }
  });

  const selectedBrand = brands.find((b) => b.id === pendingBrand);
  const filteredBrands = brandSearch.trim()
    ? brands.filter((b) =>
        b.slug !== 'other' && b.name.toLowerCase().includes(brandSearch.toLowerCase())
      )
    : brands.filter((b) => b.slug !== 'other');

  const otherBrand = brands.find((b) => b.slug === 'other');

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
          <Ionicons name="gift-outline" size={31} color="#A4C8D8" />
          <Text style={styles.wordmark}>Buy Nothing</Text>
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
            placeholder="Search for free items..."
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
        <TouchableOpacity
          style={styles.locationPill}
          onPress={() => setLocationSheetVisible(true)}
        >
          <Ionicons name="location-outline" size={15} color="#A4C8D8" />
          <Text style={styles.locationText}>
            {userLat
              ? `${locationLabel} • ${
                  activeRadius === 8047 ? '5 mi' :
                  activeRadius === 16093 ? '10 mi' :
                  activeRadius === 40234 ? '25 mi' : '50 mi'
                }`
              : 'Set your location'}
          </Text>
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#A4C8D8"
              colors={['#A4C8D8']}
            />
          }
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

          <ScrollView style={styles.filterScroll} keyboardShouldPersistTaps="handled">
            {/* CATEGORY SECTION */}
            <Text style={styles.filterSectionLabel}>CATEGORY</Text>
            <View style={styles.filterChipsRow}>
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  pendingCategory === null && styles.filterChipSelected,
                ]}
                onPress={() => {
                  setPendingCategory(null);
                  setPendingSubcategory(null);
                  setPendingAttributes({});
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    pendingCategory === null && styles.filterChipTextSelected,
                  ]}
                >
                  All
                </Text>
              </TouchableOpacity>
              {topLevelCategories.map((cat) => {
                const isSelected = pendingCategory === cat.slug;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                    ]}
                    onPress={() => {
                      if (isSelected) {
                        setPendingCategory(null);
                        setPendingSubcategory(null);
                        setPendingAttributes({});
                      } else {
                        setPendingCategory(cat.slug);
                        setPendingSubcategory(null);
                        setPendingAttributes({});
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SUBCATEGORY SECTION (only for Gear) */}
            {subcategories.length > 0 && (
              <>
                <Text style={styles.filterSectionLabel}>SUBCATEGORY</Text>
                <View style={styles.filterChipsRow}>
                  {subcategories.map((sub) => {
                    const isSelected = pendingSubcategory === sub.slug;
                    return (
                      <TouchableOpacity
                        key={sub.id}
                        style={[
                          styles.filterChip,
                          isSelected && styles.filterChipSelected,
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setPendingSubcategory(null);
                            setPendingAttributes({});
                          } else {
                            setPendingSubcategory(sub.slug);
                            setPendingAttributes({});
                          }
                        }}
                      >
                        <Text
                          style={[
                            styles.filterChipText,
                            isSelected && styles.filterChipTextSelected,
                          ]}
                        >
                          {sub.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* DYNAMIC ATTRIBUTE SECTIONS */}
            {Object.keys(attributeKeyGroups).map((attributeKey) => {
              const attributeValues = attributeKeyGroups[attributeKey];
              const displayLabel = attributeKey.replace(/_/g, ' ').toUpperCase();
              return (
                <View key={attributeKey}>
                  <Text style={styles.filterSectionLabel}>{displayLabel}</Text>
                  <View style={styles.filterChipsRow}>
                    {attributeValues.map((attrValue) => {
                      const isSelected = pendingAttributes[attributeKey] === attrValue;
                      return (
                        <TouchableOpacity
                          key={attrValue}
                          style={[
                            styles.filterChip,
                            isSelected && styles.filterChipSelected,
                          ]}
                          onPress={() => {
                            setPendingAttributes((prev) => {
                              if (prev[attributeKey] === attrValue) {
                                const { [attributeKey]: _, ...rest } = prev;
                                return rest;
                              }
                              return { ...prev, [attributeKey]: attrValue };
                            });
                          }}
                        >
                          <Text
                            style={[
                              styles.filterChipText,
                              isSelected && styles.filterChipTextSelected,
                            ]}
                          >
                            {attrValue}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            {/* DIVIDER BEFORE CONDITION */}
            {Object.keys(attributeKeyGroups).length > 0 && (
              <View style={styles.filterDivider} />
            )}

            {/* CONDITION SECTION */}
            <Text style={styles.filterSectionLabel}>CONDITION</Text>
            <View style={styles.filterChipsRow}>
              {CONDITIONS.map((cond) => {
                const isSelected = pendingConditions.includes(cond.value);
                return (
                  <TouchableOpacity
                    key={cond.value}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipSelected,
                    ]}
                    onPress={() => {
                      setPendingConditions((prev) =>
                        prev.includes(cond.value)
                          ? prev.filter((c) => c !== cond.value)
                          : [...prev, cond.value]
                      );
                    }}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextSelected,
                      ]}
                    >
                      {cond.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterDivider} />

            {/* BRAND SECTION */}
            <Text style={styles.filterSectionLabel}>BRAND</Text>
            <TouchableOpacity
              style={styles.brandPickerRow}
              onPress={() => setBrandModalVisible(true)}
            >
              <Text
                style={[
                  styles.brandPickerText,
                  selectedBrand && styles.brandPickerTextSelected,
                ]}
              >
                {selectedBrand ? selectedBrand.name : 'Any'}
              </Text>
              <Ionicons name="chevron-forward" size={18} color="#999999" />
            </TouchableOpacity>
            {pendingBrand !== null && (
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 20 }}
                onPress={() => setPendingBrand(null)}
              >
                <Text style={styles.clearBrandText}>Clear brand</Text>
              </TouchableOpacity>
            )}
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

      {/* Brand Picker Modal */}
      <Modal
        visible={brandModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setBrandModalVisible(false);
          setBrandSearch('');
        }}
      >
        <SafeAreaView style={styles.brandModalContainer} edges={['top', 'bottom']}>
          {/* Brand Modal Header */}
          <View style={styles.brandModalHeader}>
            <Text style={styles.brandModalTitle}>Select Brand</Text>
            <TouchableOpacity
              onPress={() => {
                setBrandModalVisible(false);
                setBrandSearch('');
              }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          {/* Brand Search Input */}
          <View style={styles.brandSearchContainer}>
            <Ionicons name="search-outline" size={18} color="#AAAAAA" />
            <TextInput
              style={styles.brandSearchInput}
              placeholder="Search brands..."
              placeholderTextColor="#AAAAAA"
              value={brandSearch}
              onChangeText={setBrandSearch}
              autoFocus={false}
            />
            {brandSearch !== '' && (
              <TouchableOpacity onPress={() => setBrandSearch('')}>
                <Ionicons name="close-circle" size={18} color="#AAAAAA" />
              </TouchableOpacity>
            )}
          </View>

          {/* Brand List */}
          <FlatList
            data={filteredBrands}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={() => {
              if (!otherBrand) return null;
              const isOtherSelected = pendingBrand === otherBrand.id;
              return (
                <>
                  <TouchableOpacity
                    style={styles.brandClearRow}
                    onPress={() => {
                      setPendingBrand(null);
                      setBrandModalVisible(false);
                      setBrandSearch('');
                    }}
                  >
                    <Text style={styles.brandClearText}>Any Brand</Text>
                    {pendingBrand === null && (
                      <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.brandRow,
                      isOtherSelected && styles.brandRowSelected,
                    ]}
                    onPress={() => {
                      setPendingBrand(otherBrand.id);
                      setBrandModalVisible(false);
                      setBrandSearch('');
                    }}
                  >
                    <Text style={styles.brandRowText}>{otherBrand.name}</Text>
                    {isOtherSelected && (
                      <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                    )}
                  </TouchableOpacity>
                  <View style={styles.brandDivider} />
                </>
              );
            }}
            renderItem={({ item }) => {
              const isSelected = pendingBrand === item.id;
              return (
                <TouchableOpacity
                  style={[
                    styles.brandRow,
                    isSelected && styles.brandRowSelected,
                  ]}
                  onPress={() => {
                    setPendingBrand(item.id);
                    setBrandModalVisible(false);
                    setBrandSearch('');
                  }}
                >
                  <Text style={styles.brandRowText}>{item.name}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                  )}
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={null}
          />
        </SafeAreaView>
      </Modal>

      {/* Location Sheet Modal */}
      <Modal
        visible={locationSheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLocationSheetVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top']}>
          <View style={styles.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.modalTitle}>Location</Text>
            <TouchableOpacity onPress={() => setLocationSheetVisible(false)}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.filterScroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* GPS OPTION */}
            <Text style={styles.filterSectionLabel}>USE DEVICE LOCATION</Text>
            <TouchableOpacity
              style={styles.gpsButton}
              onPress={handleUseGPS}
              disabled={locationLoading}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="navigate" size={18} color="#FFFFFF" />
                  <Text style={styles.gpsButtonText}>Use my current location</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.filterDivider} />

            {/* ZIP CODE OPTION */}
            <Text style={styles.filterSectionLabel}>OR ENTER A ZIP CODE</Text>
            <View style={styles.zipInputRow}>
              <TextInput
                style={styles.zipInput}
                placeholder="e.g. 75069"
                placeholderTextColor="#BBBBBB"
                value={zipInput}
                onChangeText={(t) => { setZipInput(t); setZipError(''); }}
                keyboardType="number-pad"
                maxLength={5}
                returnKeyType="done"
                onSubmitEditing={handleZipSubmit}
              />
              <TouchableOpacity
                style={[
                  styles.zipSubmitButton,
                  (zipLoading || zipInput.length !== 5) &&
                    styles.zipSubmitButtonDisabled,
                ]}
                onPress={handleZipSubmit}
                disabled={zipLoading || zipInput.length !== 5}
              >
                {zipLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.zipSubmitText}>Go</Text>
                )}
              </TouchableOpacity>
            </View>
            {zipError ? (
              <Text style={styles.zipError}>{zipError}</Text>
            ) : null}

            <View style={styles.filterDivider} />

            {/* RADIUS */}
            <Text style={styles.filterSectionLabel}>DISTANCE</Text>
            <View style={styles.radiusRow}>
              {RADIUS_OPTIONS.map(option => {
                const isSelected = activeRadius === option.meters;
                return (
                  <TouchableOpacity
                    key={option.meters}
                    style={[
                      styles.radiusPill,
                      isSelected && styles.radiusPillSelected,
                    ]}
                    onPress={async () => {
                      setActiveRadius(option.meters);
                      await AsyncStorage.setItem(
                        STORAGE_KEY_RADIUS,
                        String(option.meters)
                      );
                      setLocationSheetVisible(false);
                    }}
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
  freeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#A4C8D8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  freeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  pendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  pendingText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
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
  emptyStateButton: {
    marginTop: 16,
    backgroundColor: '#A4C8D8',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  emptyStateButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
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
  filterScroll: {
    flex: 1,
  },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1A1A1A',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 10,
  },
  filterChip: {
    backgroundColor: 'transparent',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  filterChipSelected: {
    backgroundColor: '#A4C8D8',
    borderColor: '#A4C8D8',
  },
  filterChipText: {
    fontSize: 14,
    color: '#666666',
  },
  filterChipTextSelected: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  filterDivider: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  brandPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#F9F9F9',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 8,
  },
  brandPickerText: {
    fontSize: 15,
    color: '#999999',
  },
  brandPickerTextSelected: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  clearBrandText: {
    fontSize: 14,
    color: '#A4C8D8',
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
  brandModalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  brandModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  brandModalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  brandSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginVertical: 12,
    gap: 8,
  },
  brandSearchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },
  brandClearRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#F9F9F9',
  },
  brandClearText: {
    fontSize: 15,
    color: '#1A1A1A',
    fontWeight: '500',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
  },
  brandRowSelected: {
    backgroundColor: '#F9F9F9',
  },
  brandRowText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  brandDivider: {
    height: 0.5,
    backgroundColor: '#F0F0F0',
    marginVertical: 8,
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
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  zipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  zipInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },
  zipSubmitButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    paddingHorizontal: 20,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zipSubmitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  zipSubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  zipError: {
    color: '#E05555',
    fontSize: 13,
    marginHorizontal: 16,
    marginTop: 4,
  },
});
