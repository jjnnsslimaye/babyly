import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

type Listing = {
  id: string;
  title: string;
  price: number;
  cover_photo_url: string;
  category_name: string;
  distance_meters: number;
  created_at: string;
};

type Category = {
  label: string;
  slug: string | null;
};

const CATEGORIES: Category[] = [
  { label: 'All Items', slug: null },
  { label: 'Clothes', slug: 'clothes' },
  { label: 'Gear', slug: 'gear' },
  { label: 'Toys', slug: 'toys' },
];

const USER_LAT = 33.1972;
const USER_LNG = -96.6397;
const RADIUS_METERS = 80467;
const PAGE_SIZE = 20;

function ListingCard({ listing }: { listing: Listing }) {
  const priceFormatted = listing.price.toFixed(2);
  const distanceMiles = (listing.distance_meters / 1609.34).toFixed(1);

  return (
    <View style={styles.listingCard}>
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
      <Text style={styles.listingTitle} numberOfLines={1}>
        {listing.title}
      </Text>
      <View style={styles.metaRow}>
        <Ionicons name="location-outline" size={11} color="#A4C8D8" />
        <Text style={styles.metaText}>
          {distanceMiles} mi • {listing.category_name}
        </Text>
      </View>
    </View>
  );
}

export default function Shop() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchListings = useCallback(
    async (pageCursor?: string) => {
      try {
        const isInitialLoad = !pageCursor;
        if (isInitialLoad) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }

        const { data, error } = await supabase.rpc('get_shop_feed', {
          user_lat: USER_LAT,
          user_lng: USER_LNG,
          user_id: null,
          radius_meters: RADIUS_METERS,
          category_slug: selectedCategory,
          page_size: PAGE_SIZE,
          page_cursor: pageCursor || null,
        });

        if (error) {
          console.error('Error fetching listings:', error);
          return;
        }

        const newListings = data || [];

        if (isInitialLoad) {
          setListings(newListings);
        } else {
          setListings((prev) => [...prev, ...newListings]);
        }

        setHasMore(newListings.length === PAGE_SIZE);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [selectedCategory]
  );

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleCategoryPress = (slug: string | null) => {
    setSelectedCategory(slug);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore || listings.length === 0) return;

    const lastListing = listings[listings.length - 1];
    fetchListings(lastListing.created_at);
  };

  const renderListingCard = ({ item }: { item: Listing }) => (
    <ListingCard listing={item} />
  );

  if (loading) {
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
        <Text style={styles.headerTitle}>Babyly</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="search-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="notifications-outline" size={24} color="#1A1A1A" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Location Bar */}
      <TouchableOpacity style={styles.locationBar} onPress={() => {}}>
        <View style={styles.locationLeft}>
          <Ionicons name="location-outline" size={18} color="#A4C8D8" />
          <View style={styles.locationTextColumn}>
            <Text style={styles.locationLabel}>SHOWING ITEMS NEAR</Text>
            <Text style={styles.locationValue}>McKinney, TX • 10 miles</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#999999" />
      </TouchableOpacity>

      {/* Category Pills */}
      <View style={styles.categoryRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScrollContent}
        >
          {CATEGORIES.map((category) => {
            const isSelected = category.slug === selectedCategory;
            return (
              <TouchableOpacity
                key={category.slug || 'all'}
                style={[
                  styles.categoryPill,
                  isSelected && styles.categoryPillSelected,
                ]}
                onPress={() => handleCategoryPress(category.slug)}
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
        </ScrollView>
        <TouchableOpacity style={styles.filterButton} onPress={() => {}}>
          <Ionicons name="options-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      {/* Listing Grid */}
      <FlatList
        data={listings}
        renderItem={renderListingCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1A1A1A',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  locationBar: {
    backgroundColor: '#F7F7F7',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationTextColumn: {
    gap: 2,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.5,
  },
  locationValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  categoryScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
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
  filterButton: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  columnWrapper: {
    paddingHorizontal: 12,
    gap: 8,
  },
  itemSeparator: {
    height: 8,
  },
  listingCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoContainer: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
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
  listingTitle: {
    paddingHorizontal: 8,
    paddingTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 2,
    paddingBottom: 8,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#999999',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
