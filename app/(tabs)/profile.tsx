import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Animated,
  PanResponder,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet, { ActionSheetOption } from '../../components/ActionSheet';

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

type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  location_label: string | null;
  account_tier: string;
  verification_status: string;
  total_listings: number;
  total_sold: number;
  avg_rating: number | null;
  rating_count: number;
  bio: Record<string, string>;
};

type MyListing = {
  id: string;
  listing_type: 'listing' | 'buy_nothing';
  title: string;
  price: number | null;
  cover_photo_url: string | null;
  status: string;
  category_name: string | null;
  created_at: string;
};

type FavoriteListing = {
  id: string;
  listing_type: 'listing' | 'buy_nothing';
  title: string;
  price: number | null;
  cover_photo_url: string | null;
  status: string;
  category_name: string | null;
  condition: string;
  distance_meters: number | null;
  liked_at: string;
};

type ProfileQuestion = {
  id: string;
  question_key: string;
  prompt_text: string;
  sort_order: number;
};

type ActiveTab = 'listings' | 'favorites' | 'gettoknow' | 'settings';

function listingHref(listing: { id: string; listing_type: 'listing' | 'buy_nothing' }) {
  return listing.listing_type === 'buy_nothing'
    ? `/listing/${listing.id}?type=buy_nothing`
    : `/listing/${listing.id}`;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'available') return null;

  const config: Record<string, { label: string; bg: string; text: string }> = {
    pending:  { label: 'Pending',  bg: '#FFF3E0', text: '#FF9500' },
    sold:     { label: 'Sold',     bg: '#E8F5E9', text: '#34C759' },
    claimed:  { label: 'Claimed',  bg: '#E8F5E9', text: '#34C759' },
    archived: { label: 'Archived', bg: '#F5F5F5', text: '#999999' },
  };

  const c = config[status];
  if (!c) return null;

  return (
    <View style={[styles.statusBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusBadgeText, { color: c.text }]}>
        {c.label}
      </Text>
    </View>
  );
}

const SWIPE_THRESHOLD = 40;
const ACTION_WIDTH = 160; // two buttons at 80px each

type SwipeableRowProps = {
  children: React.ReactNode;
  onManage: () => void;
  onQuickAction: () => void;
  quickActionLabel: string;
  quickActionIcon: string;
  isFirst?: boolean;
  itemId: string;
  onOpen?: (id: string) => void;
  onRegisterClose?: (id: string, closeFn: () => void) => void;
};

function SwipeableRow({
  children,
  onManage,
  onQuickAction,
  quickActionLabel,
  quickActionIcon,
  isFirst,
  itemId,
  onOpen,
  onRegisterClose,
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);
  const hintAnimated = useRef(false);

  useEffect(() => {
    if (!isFirst || hintAnimated.current) return;
    hintAnimated.current = true;
    const runHint = async () => {
      const seen = await AsyncStorage.getItem('babyly_listings_hint_seen');
      if (seen) return;
      setTimeout(() => {
        Animated.sequence([
          Animated.timing(translateX, {
            toValue: -ACTION_WIDTH,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.delay(600),
          Animated.timing(translateX, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => {
          AsyncStorage.setItem('babyly_listings_hint_seen', 'true');
        });
      }, 800);
    };
    runHint();
  }, []);

  useEffect(() => {
    onRegisterClose?.(itemId, close);
    return () => {
      // Cleanup on unmount
    };
  }, [itemId]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderMove: (_, gestureState) => {
        const newX = isOpen.current
          ? Math.min(0, -ACTION_WIDTH + gestureState.dx)
          : Math.min(0, gestureState.dx);
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isOpen.current) {
          // Row is open — swipe right to close, swipe left to keep open
          if (gestureState.dx > SWIPE_THRESHOLD) {
            isOpen.current = false;
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: -ACTION_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        } else {
          // Row is closed — swipe left to open
          if (gestureState.dx < -SWIPE_THRESHOLD) {
            isOpen.current = true;
            onOpen?.(itemId);
            Animated.spring(translateX, {
              toValue: -ACTION_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        }
      },
    })
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action buttons revealed behind the row */}
      <View style={swipeStyles.actionsContainer}>
        <TouchableOpacity
          style={swipeStyles.actionManage}
          onPress={() => { close(); onManage(); }}
        >
          <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          <Text style={swipeStyles.actionText}>Manage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={swipeStyles.actionQuick}
          onPress={() => { close(); onQuickAction(); }}
        >
          <Ionicons name={quickActionIcon as any} size={18} color="#FFFFFF" />
          <Text style={swipeStyles.actionText}>{quickActionLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* The row itself slides left */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  actionManage: {
    flex: 1,
    backgroundColor: '#A4C8D8',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionQuick: {
    flex: 1,
    backgroundColor: '#999999',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
});

export default function Profile() {
  const router = useRouter();
  const { session, loadingSession } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [questions, setQuestions] = useState<ProfileQuestion[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('listings');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingListings, setLoadingListings] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [editingAnswers, setEditingAnswers] = useState<Record<string, string>>({});
  const [savingAnswers, setSavingAnswers] = useState(false);

  // Name editing (Settings)
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState({ first: '', last: '' });
  const [savingName, setSavingName] = useState(false);

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Location modal (Settings)
  const [locationSheetVisible, setLocationSheetVisible] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // Action sheet (listing management options + delete confirmation)
  const [actionSheet, setActionSheet] = useState<{
    visible: boolean;
    title: string;
    options: ActionSheetOption[];
  }>({ visible: false, title: '', options: [] });

  const listingsFetched = useRef(false);
  const favoritesFetched = useRef(false);

  // Tracks close functions for swipeable rows so only one is open at a time
  const rowCloseRefs = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!session) return;
    fetchProfile();
    fetchQuestions();
    // Pre-fetch listings since it's the default tab
    if (!listingsFetched.current) {
      listingsFetched.current = true;
      fetchListings();
    }
  }, [session?.user?.id]);

  const fetchProfile = async () => {
    if (!session) return;
    setLoadingProfile(true);
    try {
      const [userResult, favCountResult] = await Promise.all([
        supabase
          .from('users')
          .select(
            'id, first_name, last_name, avatar_url, location_label, account_tier, verification_status, total_listings, total_sold, avg_rating, rating_count, bio'
          )
          .eq('id', session.user.id)
          .single(),
        supabase
          .from('listing_likes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', session.user.id),
      ]);

      if (userResult.error) {
        console.error('Error fetching profile:', userResult.error);
        setLoadingProfile(false);
        return;
      }

      const row = userResult.data as any;
      setProfile({
        id: row.id,
        first_name: row.first_name || '',
        last_name: row.last_name || '',
        avatar_url: row.avatar_url,
        location_label: row.location_label,
        account_tier: row.account_tier || 'free',
        verification_status: row.verification_status || 'unverified',
        total_listings: row.total_listings || 0,
        total_sold: row.total_sold || 0,
        avg_rating: row.avg_rating,
        rating_count: row.rating_count || 0,
        bio: row.bio || {},
      });
      setFavoritesCount(favCountResult.count || 0);
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  };

  const fetchListings = async () => {
    if (!session) return;
    setLoadingListings(true);
    try {
      const { data, error } = await supabase.rpc('get_my_listings', {
        p_user_id: session.user.id,
      });
      if (error) {
        console.error('Error fetching listings:', error);
        return;
      }
      setListings(data || []);
    } catch (err) {
      console.error('Error fetching listings:', err);
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchFavorites = async () => {
    if (!session) return;
    setLoadingFavorites(true);
    try {
      const lat = await AsyncStorage.getItem('babyly_user_lat');
      const lng = await AsyncStorage.getItem('babyly_user_lng');
      const { data, error } = await supabase.rpc('get_my_favorites', {
        p_user_id: session.user.id,
        p_user_lat: lat ? parseFloat(lat) : null,
        p_user_lng: lng ? parseFloat(lng) : null,
      });
      if (error) {
        console.error('Error fetching favorites:', error);
        return;
      }
      setFavorites(data || []);
    } catch (err) {
      console.error('Error fetching favorites:', err);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const handleUnfavorite = async (item: FavoriteListing) => {
    const listingType = item.listing_type;

    // Optimistically remove from list and decrement count
    setFavorites((prev) => prev.filter((f) => f.id !== item.id));
    setFavoritesCount((prev) => Math.max(0, prev - 1));

    const { error } = await supabase.rpc('set_listing_like', {
      p_user_id: session!.user.id,
      p_listing_id: item.id,
      p_listing_type: listingType,
      p_liked: false,
    });

    if (error) {
      console.error('Error unliking listing:', error);
      // Revert on failure
      setFavorites((prev) => [...prev, item]);
      setFavoritesCount((prev) => prev + 1);
    }
  };

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_questions')
        .select('id, question_key, prompt_text, sort_order')
        .eq('is_active', true)
        .order('sort_order');
      if (error) {
        console.error('Error fetching questions:', error);
        return;
      }
      setQuestions(data || []);
    } catch (err) {
      console.error('Error fetching questions:', err);
    }
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'listings' && !listingsFetched.current) {
      listingsFetched.current = true;
      fetchListings();
    }
    if (tab === 'favorites' && !favoritesFetched.current) {
      favoritesFetched.current = true;
      fetchFavorites();
    }
  };

  // ─── Get to Know You handlers ────────────────────────────
  const handleStartEditAnswer = (key: string) => {
    if (!profile) return;
    setEditingAnswers({ [key]: profile.bio[key] || '' });
  };

  const handleChangeAnswer = (key: string, value: string) => {
    setEditingAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handleCancelAnswer = () => {
    setEditingAnswers({});
  };

  const handleSaveAnswer = async (key: string) => {
    if (!session || !profile) return;
    const value = (editingAnswers[key] || '').trim();
    setSavingAnswers(true);
    try {
      const newBio = { ...profile.bio, [key]: value };
      const { error } = await supabase
        .from('users')
        .update({ bio: newBio })
        .eq('id', session.user.id);
      if (error) throw error;
      setProfile({ ...profile, bio: newBio });
      setEditingAnswers({});
    } catch (err) {
      console.error('Error saving answer:', err);
      Alert.alert('Save failed', 'Could not save your answer. Please try again.');
    } finally {
      setSavingAnswers(false);
    }
  };

  // ─── Name edit handlers ──────────────────────────────────
  const handleStartEditName = () => {
    if (!profile) return;
    setNameDraft({ first: profile.first_name, last: profile.last_name });
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setEditingName(false);
  };

  const handleSaveName = async () => {
    if (!session || !profile) return;
    const first = nameDraft.first.trim();
    const last = nameDraft.last.trim();
    if (!first || !last) {
      Alert.alert('Missing name', 'Please enter both a first and last name.');
      return;
    }
    setSavingName(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ first_name: first, last_name: last })
        .eq('id', session.user.id);
      if (error) throw error;
      setProfile({ ...profile, first_name: first, last_name: last });
      setEditingName(false);
    } catch (err) {
      console.error('Error saving name:', err);
      Alert.alert('Save failed', 'Could not update your name.');
    } finally {
      setSavingName(false);
    }
  };

  // ─── Avatar handlers ─────────────────────────────────────
  const handlePickAvatar = async () => {
    if (!session) return;

    const hasPhoto = !!profile?.avatar_url;

    const options = [
      {
        text: 'Take Photo',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Please grant camera access to take a photo.');
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) await uploadAvatar(result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission required', 'Please grant photo library access.');
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled) await uploadAvatar(result.assets[0].uri);
        },
      },
      ...(hasPhoto
        ? [
            {
              text: 'Remove Photo',
              style: 'destructive' as const,
              onPress: async () => {
                try {
                  const { error } = await supabase
                    .from('users')
                    .update({ avatar_url: null })
                    .eq('id', session.user.id);
                  if (error) throw error;
                  setProfile((prev) =>
                    prev ? { ...prev, avatar_url: null } : prev
                  );
                } catch (err) {
                  console.error('Error removing avatar:', err);
                  Alert.alert('Error', 'Could not remove photo. Please try again.');
                }
              },
            },
          ]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ];

    Alert.alert('Profile Photo', 'Choose an option', options);
  };

  const uploadAvatar = async (uri: string) => {
    if (!session) return;
    setUploadingAvatar(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);
      const timestamp = Date.now();
      const filePath = `${session.user.id}/${timestamp}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);
      if (updateError) throw updateError;

      setProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
    } catch (err) {
      console.error('Error uploading avatar:', err);
      Alert.alert('Upload failed', 'Could not upload your avatar. Please try again.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // ─── Location handlers (Settings) ────────────────────────
  const persistLocation = async (lat: number, lng: number, label: string) => {
    if (!session || !profile) return;
    const { error } = await supabase
      .from('users')
      .update({ location_label: label })
      .eq('id', session.user.id);
    if (error) {
      console.error('Error saving location:', error);
      throw error;
    }
    setProfile({ ...profile, location_label: label });
    // Sync AsyncStorage so Shop/Free feed reflects the change immediately
    await AsyncStorage.setItem('babyly_user_lat', String(lat));
    await AsyncStorage.setItem('babyly_user_lng', String(lng));
    await AsyncStorage.setItem('babyly_location_label', label);
  };

  const handleUseGPS = async () => {
    setLocationLoading(true);
    setZipError('');
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
      const abbreviatedRegion = STATE_NAME_TO_ABBR[rawRegion] || rawRegion;
      const label = place
        ? `${place.city || place.district || ''}, ${abbreviatedRegion}`
            .trim()
            .replace(/^,|,$/g, '')
        : 'Current location';
      await persistLocation(latitude, longitude, label);
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
      await persistLocation(latitude, longitude, label);
      setLocationSheetVisible(false);
    } catch (e) {
      console.error('ZIP geocoding error:', e);
      setZipError('Could not find that ZIP code. Please try again.');
    } finally {
      setZipLoading(false);
      setZipInput('');
    }
  };

  // ─── Sign out ─────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(tabs)/shop');
        },
      },
    ]);
  };

  // ─── Listing card interactions ────────────────────────────
  const handleOpenListing = (listing: { id: string; listing_type: 'listing' | 'buy_nothing' }) => {
    router.push(listingHref(listing));
  };

  const handleLongPressMyListing = (listing: MyListing) => {
    const isBuyNothing = listing.listing_type === 'buy_nothing';
    const { status } = listing;

    const canArchive = status !== 'archived';
    const canEdit = status !== 'sold' && status !== 'claimed';

    const options: ActionSheetOption[] = [];

    if (canEdit) {
      options.push({
        label: 'Edit listing',
        onPress: () => router.push(`/sell?id=${listing.id}&type=${listing.listing_type}`),
      });
    }

    if (status === 'available') {
      options.push({
        label: 'Mark as Pending',
        onPress: () => handleUpdateStatus(listing, 'pending'),
      });
      options.push({
        label: isBuyNothing ? 'Mark as Claimed' : 'Mark as Sold',
        onPress: () => handleUpdateStatus(listing, isBuyNothing ? 'claimed' : 'sold'),
      });
    } else if (status === 'pending') {
      options.push({
        label: 'Mark as Available',
        onPress: () => handleUpdateStatus(listing, 'available'),
      });
      options.push({
        label: isBuyNothing ? 'Mark as Claimed' : 'Mark as Sold',
        onPress: () => handleUpdateStatus(listing, isBuyNothing ? 'claimed' : 'sold'),
      });
    } else if (status === 'sold') {
      options.push({
        label: 'Mark as Available',
        onPress: () => handleUpdateStatus(listing, 'available'),
      });
      options.push({
        label: 'Mark as Pending',
        onPress: () => handleUpdateStatus(listing, 'pending'),
      });
    } else if (status === 'claimed') {
      options.push({
        label: 'Mark as Available',
        onPress: () => handleUpdateStatus(listing, 'available'),
      });
      options.push({
        label: 'Mark as Pending',
        onPress: () => handleUpdateStatus(listing, 'pending'),
      });
    } else if (status === 'archived') {
      options.push({
        label: 'Relist as Available',
        onPress: () => handleUpdateStatus(listing, 'available'),
      });
    }

    if (canArchive) {
      options.push({
        label: 'Archive',
        onPress: () => handleUpdateStatus(listing, 'archived'),
      });
    }

    options.push({
      label: 'Delete listing',
      onPress: () => handleDeleteListing(listing),
      destructive: true,
    });

    setActionSheet({
      visible: true,
      title: listing.title,
      options,
    });
  };

  const handleUpdateStatus = async (
    listing: MyListing,
    newStatus: string
  ) => {
    const table =
      listing.listing_type === 'listing'
        ? 'listings'
        : 'buy_nothing_listings';

    const { error } = await supabase
      .from(table)
      .update({ status: newStatus })
      .eq('id', listing.id);

    if (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Could not update listing status. Please try again.');
      return;
    }

    setListings((prev) =>
      prev.map((l) =>
        l.id === listing.id ? { ...l, status: newStatus } : l
      )
    );
  };

  const handleDeleteListing = (listing: MyListing) => {
    setActionSheet({
      visible: true,
      title: 'Delete this listing?',
      options: [
        {
          label: 'Delete permanently',
          destructive: true,
          onPress: async () => {
            const table =
              listing.listing_type === 'listing'
                ? 'listings'
                : 'buy_nothing_listings';

            const { error } = await supabase
              .from(table)
              .delete()
              .eq('id', listing.id);

            if (error) {
              console.error('Error deleting listing:', error);
              Alert.alert('Error', 'Could not delete listing. Please try again.');
              return;
            }

            setListings((prev) => prev.filter((l) => l.id !== listing.id));
          },
        },
      ],
    });
  };

  // ─── Render helpers ───────────────────────────────────────
  if (loadingSession || !session) {
    return (
      <View style={styles.loadingFull}>
        <ActivityIndicator size="large" color="#A4C8D8" />
      </View>
    );
  }

  if (loadingProfile || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingFull}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      </SafeAreaView>
    );
  }

  const initials = `${profile.first_name.charAt(0)}${profile.last_name.charAt(0)}`.toUpperCase();
  const fullName = `${profile.first_name} ${profile.last_name}`.trim();

  const renderListingsTab = () => {
    if (loadingListings) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      );
    }
    if (listings.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="bag-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateTitle}>No listings yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Tap the + button to post your first listing
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={listings}
        keyExtractor={(item) => `${item.listing_type}-${item.id}`}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => {
          const isFirst = index === 0;
          const archiveLabel = item.status === 'archived'
            ? 'Relist'
            : 'Archive';
          const archiveValue = item.status === 'archived'
            ? 'available'
            : 'archived';

          return (
            <SwipeableRow
              isFirst={isFirst}
              itemId={item.id}
              onRegisterClose={(id, closeFn) => {
                rowCloseRefs.current.set(id, closeFn);
              }}
              onOpen={(id) => {
                // Close all other open rows
                rowCloseRefs.current.forEach((closeFn, rowId) => {
                  if (rowId !== id) closeFn();
                });
              }}
              onManage={() => handleLongPressMyListing(item)}
              onQuickAction={() => handleUpdateStatus(item, archiveValue)}
              quickActionLabel={archiveLabel}
              quickActionIcon={item.status === 'archived'
                ? 'refresh-outline'
                : 'archive-outline'}
            >
              <TouchableOpacity
                style={styles.listRow}
                onPress={() => handleOpenListing(item)}
                activeOpacity={0.7}
              >
                {/* Thumbnail */}
                <View style={styles.listThumb}>
                  {item.cover_photo_url ? (
                    <Image
                      source={{ uri: item.cover_photo_url }}
                      style={styles.listThumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={styles.listThumbPlaceholder}>
                      <Ionicons name="image-outline" size={24} color="#CCCCCC" />
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={styles.listInfo}>
                  <Text style={styles.listTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  <Text style={styles.listCategory} numberOfLines={1}>
                    {item.category_name || 'Uncategorized'}
                  </Text>
                  <View style={styles.listMeta}>
                    {item.listing_type === 'listing' && item.price !== null ? (
                      <Text style={styles.listPrice}>
                        ${item.price.toFixed(2)}
                      </Text>
                    ) : (
                      <Text style={styles.listPriceFree}>Free</Text>
                    )}
                    {item.status !== 'available' && (
                      <StatusBadge status={item.status} />
                    )}
                  </View>
                </View>

                {/* Swipe hint icon */}
                <Ionicons
                  name="chevron-back-outline"
                  size={16}
                  color="#CCCCCC"
                />
              </TouchableOpacity>
            </SwipeableRow>
          );
        }}
      />
    );
  };

  const renderFavoritesTab = () => {
    if (loadingFavorites) {
      return (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      );
    }
    if (favorites.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateTitle}>No favorites yet</Text>
          <Text style={styles.emptyStateSubtitle}>
            Tap the heart on any listing to save it here
          </Text>
        </View>
      );
    }
    return (
      <FlatList
        data={favorites}
        keyExtractor={(item) => `${item.listing_type}-${item.id}`}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        refreshControl={
          <RefreshControl
            refreshing={loadingFavorites}
            onRefresh={() => {
              favoritesFetched.current = false;
              fetchFavorites();
            }}
            tintColor="#A4C8D8"
            colors={['#A4C8D8']}
          />
        }
        renderItem={({ item }) => {
          const distanceMiles = item.distance_meters
            ? (item.distance_meters / 1609.34).toFixed(1)
            : null;
          const conditionMap: Record<string, string> = {
            new_unopened: 'New (Unopened)',
            like_new: 'Like New',
            gently_used: 'Gently Used',
            used: 'Used',
          };
          const conditionLabel = conditionMap[item.condition] || item.condition;

          return (
            <TouchableOpacity
              style={styles.favCard}
              onPress={() => handleOpenListing(item)}
              activeOpacity={0.8}
            >
              <View style={styles.favPhotoContainer}>
                {item.cover_photo_url ? (
                  <Image
                    source={{ uri: item.cover_photo_url }}
                    style={styles.favPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.favPhotoPlaceholder}>
                    <Ionicons name="image-outline" size={32} color="#CCCCCC" />
                  </View>
                )}
                {/* Pending badge */}
                {item.status === 'pending' && (
                  <View style={styles.favPendingBadge}>
                    <Text style={styles.favPendingText}>Pending</Text>
                  </View>
                )}
                {/* Price badge */}
                {item.listing_type === 'listing' && item.price !== null ? (
                  <View style={styles.favPriceBadge}>
                    <Text style={styles.favPriceText}>
                      ${item.price.toFixed(2)}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.favFreeBadge}>
                    <Text style={styles.favFreeText}>FREE</Text>
                  </View>
                )}
                {/* Heart — tap to unlike */}
                <TouchableOpacity
                  style={styles.favHeartBadge}
                  onPress={() => handleUnfavorite(item)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="heart" size={18} color="#FF5A5F" />
                </TouchableOpacity>
              </View>
              <View style={styles.favCardBody}>
                <Text style={styles.favTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View style={styles.favMetaRow}>
                  <Text style={styles.favCondition}>
                    {conditionLabel.toUpperCase()}
                  </Text>
                  {distanceMiles && (
                    <View style={styles.favDistanceContainer}>
                      <Ionicons
                        name="location-outline"
                        size={11}
                        color="#A4C8D8"
                      />
                      <Text style={styles.favDistanceText}>
                        {distanceMiles} mi
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderGetToKnowTab = () => {
    if (questions.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>
      );
    }
    return (
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        keyboardShouldPersistTaps="handled"
      >
        {questions.map((q) => {
          const isEditing = Object.prototype.hasOwnProperty.call(editingAnswers, q.question_key);
          const savedAnswer = profile.bio[q.question_key];
          const draft = editingAnswers[q.question_key] ?? '';

          return (
            <View key={q.id} style={styles.questionBlock}>
              <Text style={styles.questionPrompt}>{q.prompt_text}</Text>

              {isEditing ? (
                <>
                  <TextInput
                    style={styles.answerInput}
                    value={draft}
                    onChangeText={(t) => handleChangeAnswer(q.question_key, t)}
                    multiline
                    autoFocus
                    placeholder="Type your answer..."
                    placeholderTextColor="#CCCCCC"
                    editable={!savingAnswers}
                  />
                  <View style={styles.answerActions}>
                    <TouchableOpacity
                      style={styles.answerSaveButton}
                      onPress={() => handleSaveAnswer(q.question_key)}
                      disabled={savingAnswers}
                    >
                      {savingAnswers ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.answerSaveText}>Save</Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleCancelAnswer}
                      disabled={savingAnswers}
                    >
                      <Text style={styles.answerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => handleStartEditAnswer(q.question_key)}
                  activeOpacity={0.6}
                >
                  {savedAnswer ? (
                    <Text style={styles.answerText}>{savedAnswer}</Text>
                  ) : (
                    <Text style={styles.answerPlaceholder}>Tap to add your answer</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  const renderSettingsTab = () => {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollPad}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionHeader}>ACCOUNT</Text>

        {/* Display name */}
        {editingName ? (
          <View style={styles.nameEditContainer}>
            <View style={styles.nameInputsRow}>
              <TextInput
                style={[styles.nameInput, { marginRight: 8 }]}
                value={nameDraft.first}
                onChangeText={(t) => setNameDraft((prev) => ({ ...prev, first: t }))}
                placeholder="First name"
                placeholderTextColor="#CCCCCC"
                editable={!savingName}
                autoFocus
              />
              <TextInput
                style={styles.nameInput}
                value={nameDraft.last}
                onChangeText={(t) => setNameDraft((prev) => ({ ...prev, last: t }))}
                placeholder="Last name"
                placeholderTextColor="#CCCCCC"
                editable={!savingName}
              />
            </View>
            <View style={styles.answerActions}>
              <TouchableOpacity
                style={styles.answerSaveButton}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.answerSaveText}>Save</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancelEditName} disabled={savingName}>
                <Text style={styles.answerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.settingsRow} onPress={handleStartEditName}>
            <Text style={styles.settingsLabel}>Name</Text>
            <View style={styles.settingsRight}>
              <Text style={styles.settingsValue}>{fullName}</Text>
              <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
            </View>
          </TouchableOpacity>
        )}

        {/* Location */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => setLocationSheetVisible(true)}
        >
          <Text style={styles.settingsLabel}>Location</Text>
          <View style={styles.settingsRight}>
            <Text style={styles.settingsValue}>
              {profile.location_label || 'Not set'}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
          </View>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>APP</Text>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/about')}
        >
          <Text style={styles.settingsLabel}>About Babyly</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut}>
          <Text style={[styles.settingsLabel, styles.signOutText]}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ───── Header ───── */}
      <View style={styles.header}>
        {/* Avatar — centered, tappable */}
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handlePickAvatar}
          disabled={uploadingAvatar}
          activeOpacity={0.8}
        >
          {uploadingAvatar ? (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <ActivityIndicator size="small" color="#FFFFFF" />
            </View>
          ) : profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          {/* Edit hint badge */}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera-outline" size={12} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* Name and location */}
        <Text style={styles.name}>{fullName}</Text>
        {profile.location_label ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={12} color="#A4C8D8" />
            <Text style={styles.locationText}>{profile.location_label}</Text>
          </View>
        ) : null}

        {/* Ratings */}
        <View style={styles.ratingsRow}>
          {profile.rating_count > 0 && profile.avg_rating !== null ? (
            <>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.ratingValue}>{profile.avg_rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>
                ({profile.rating_count} ratings)
              </Text>
            </>
          ) : (
            <Text style={styles.noRatingsText}>No ratings yet</Text>
          )}
        </View>

      </View>

      <View style={styles.headerDivider} />

      {/* ───── Tab Switcher ───── */}
      <View style={styles.tabBar}>
        {([
          { key: 'listings', label: `Listings (${profile.total_listings})` },
          { key: 'favorites', label: `Favorites (${favoritesCount})` },
          { key: 'gettoknow', label: 'Bio' },
          { key: 'settings', label: 'Settings' },
        ] as { key: ActiveTab; label: string }[]).map((t) => {
          const isActive = activeTab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => handleTabChange(t.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ───── Tab Content ───── */}
      <View style={styles.tabContent}>
        {activeTab === 'listings' && renderListingsTab()}
        {activeTab === 'favorites' && renderFavoritesTab()}
        {activeTab === 'gettoknow' && renderGetToKnowTab()}
        {activeTab === 'settings' && renderSettingsTab()}
      </View>

      {/* ───── Location Sheet Modal ───── */}
      <Modal
        visible={locationSheetVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLocationSheetVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <View style={{ width: 60 }} />
            <Text style={styles.modalTitle}>Location</Text>
            <TouchableOpacity onPress={() => setLocationSheetVisible(false)}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalSectionLabel}>USE DEVICE LOCATION</Text>
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

            <View style={styles.modalDivider} />

            <Text style={styles.modalSectionLabel}>OR ENTER A ZIP CODE</Text>
            <View style={styles.zipInputRow}>
              <TextInput
                style={styles.zipInput}
                placeholder="e.g. 75069"
                placeholderTextColor="#BBBBBB"
                value={zipInput}
                onChangeText={(t) => {
                  setZipInput(t);
                  setZipError('');
                }}
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
            {zipError ? <Text style={styles.zipError}>{zipError}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <ActionSheet
        visible={actionSheet.visible}
        title={actionSheet.title}
        options={actionSheet.options}
        onClose={() => setActionSheet((prev) => ({ ...prev, visible: false }))}
      />
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
    backgroundColor: '#FAFAFA',
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: '#FAFAFA',
    alignItems: 'center',
  },
  avatarContainer: {
    alignSelf: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
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
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FAFAFA',
  },
  name: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
    textAlign: 'center',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    marginBottom: 8,
  },
  ratingValue: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
  },
  ratingCount: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },
  noRatingsText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#CCCCCC',
  },
  headerDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
  },

  // ─── Tab Bar ──────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#A4C8D8',
  },
  tabText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
  },
  tabTextActive: {
    fontFamily: 'Quicksand_700Bold',
    color: '#1A1A1A',
  },
  tabContent: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  tabLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  // ─── Grid (Listings / Favorites) ──────────────────────────
  gridContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    flex: 1,
  },
  photoSquare: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
  },
  favoriteHeart: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#1A1A1A',
    marginTop: 8,
  },
  cardPrice: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginTop: 2,
  },
  cardPriceFree: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#A4C8D8',
    marginTop: 2,
  },

  // ─── Favorites tab cards ──────────────────────────────────
  favCard: {
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
  favPhotoContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#F0F0F0',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  favPhoto: {
    width: '100%',
    height: '100%',
  },
  favPhotoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favPendingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.9)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  favPendingText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
  },
  favPriceBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favPriceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  favFreeBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#A4C8D8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  favFreeText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  favHeartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favCardBody: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
  },
  favTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  favMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  favCondition: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.3,
  },
  favDistanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  favDistanceText: {
    fontSize: 11,
    color: '#999999',
  },

  // ─── List view (Listings tab) ─────────────────────────────
  listContent: {
    paddingHorizontal: 0,
    paddingBottom: 32,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  listThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  listThumbImage: {
    width: '100%',
    height: '100%',
  },
  listThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    lineHeight: 20,
  },
  listCategory: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },
  listMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  listPrice: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
  },
  listPriceFree: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#A4C8D8',
  },

  // ─── Empty state ──────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyStateTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginTop: 6,
  },
  comingSoon: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#CCCCCC',
    textAlign: 'center',
  },

  // ─── Get to Know You ──────────────────────────────────────
  scrollPad: {
    paddingBottom: 32,
  },
  questionBlock: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  questionPrompt: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  answerText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#444444',
    lineHeight: 20,
  },
  answerPlaceholder: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#CCCCCC',
    fontStyle: 'italic',
  },
  answerInput: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  answerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  answerSaveButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    minWidth: 64,
    alignItems: 'center',
  },
  answerSaveText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  answerCancelText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },

  // ─── Settings ─────────────────────────────────────────────
  sectionHeader: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#999999',
    letterSpacing: 0.8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#FFFFFF',
  },
  settingsLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
  },
  settingsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '60%',
  },
  settingsValue: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#999999',
  },
  signOutText: {
    color: '#E05555',
  },
  avatarThumb: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarThumbPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarThumbInitials: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  nameEditContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  nameInputsRow: {
    flexDirection: 'row',
  },
  nameInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
    backgroundColor: '#FAFAFA',
  },

  // ─── Modal (Location Sheet) ───────────────────────────────
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
  modalTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 17,
    color: '#1A1A1A',
  },
  modalScroll: {
    flex: 1,
  },
  modalSectionLabel: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 12,
    color: '#999999',
    letterSpacing: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginTop: 16,
    marginHorizontal: 20,
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
  },
  gpsButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    color: '#FFFFFF',
    fontSize: 15,
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
    fontFamily: 'Quicksand_600SemiBold',
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
    fontFamily: 'Quicksand_700Bold',
    color: '#FFFFFF',
    fontSize: 15,
  },
  zipError: {
    color: '#E05555',
    fontSize: 13,
    marginHorizontal: 16,
    marginTop: 4,
  },
});
