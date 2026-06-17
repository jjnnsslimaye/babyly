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
  ActionSheetIOS,
  Platform,
  Modal,
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

  let label = '';
  let bg = '#999999';
  if (status === 'pending') {
    label = 'Pending';
    bg = '#FF9500';
  } else if (status === 'sold') {
    label = 'Sold';
    bg = '#999999';
  } else if (status === 'claimed') {
    label = 'Claimed';
    bg = '#999999';
  } else {
    return null;
  }

  return (
    <View style={[styles.statusBadge, { backgroundColor: bg }]}>
      <Text style={styles.statusBadgeText}>{label}</Text>
    </View>
  );
}

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

  const listingsFetched = useRef(false);
  const favoritesFetched = useRef(false);

  useEffect(() => {
    if (!loadingSession && !session) {
      router.push('/login');
    }
  }, [loadingSession]);

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
      const { data, error } = await supabase.rpc('get_my_favorites', {
        p_user_id: session.user.id,
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
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library access to update your avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const uri = result.assets[0].uri;
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

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath);

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
    const navigateToEdit = () => {
      router.push(`/sell?id=${listing.id}&type=${listing.listing_type}`);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit listing'],
          cancelButtonIndex: 0,
        },
        (idx) => {
          if (idx === 1) navigateToEdit();
        }
      );
    } else {
      Alert.alert('Listing options', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit listing', onPress: navigateToEdit },
      ]);
    }
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
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={styles.gridContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => handleOpenListing(item)}
            onLongPress={() => handleLongPressMyListing(item)}
            delayLongPress={300}
          >
            <View style={styles.photoSquare}>
              {item.cover_photo_url ? (
                <Image
                  source={{ uri: item.cover_photo_url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#CCCCCC" />
                </View>
              )}
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.listing_type === 'listing' && item.price !== null ? (
              <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
            ) : (
              <Text style={styles.cardPriceFree}>Free</Text>
            )}
          </TouchableOpacity>
        )}
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
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => handleOpenListing(item)}
          >
            <View style={styles.photoSquare}>
              {item.cover_photo_url ? (
                <Image
                  source={{ uri: item.cover_photo_url }}
                  style={styles.photoImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="image-outline" size={32} color="#CCCCCC" />
                </View>
              )}
              <View style={styles.favoriteHeart}>
                <Ionicons name="heart" size={12} color="#FF5A5F" />
              </View>
            </View>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.listing_type === 'listing' && item.price !== null ? (
              <Text style={styles.cardPrice}>${item.price.toFixed(2)}</Text>
            ) : (
              <Text style={styles.cardPriceFree}>Free</Text>
            )}
          </TouchableOpacity>
        )}
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

        {/* Avatar */}
        <TouchableOpacity
          style={styles.settingsRow}
          onPress={handlePickAvatar}
          disabled={uploadingAvatar}
        >
          <Text style={styles.settingsLabel}>Avatar</Text>
          <View style={styles.settingsRight}>
            {uploadingAvatar ? (
              <ActivityIndicator size="small" color="#A4C8D8" style={{ marginRight: 8 }} />
            ) : profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarThumb} />
            ) : (
              <View style={styles.avatarThumbPlaceholder}>
                <Text style={styles.avatarThumbInitials}>{initials}</Text>
              </View>
            )}
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
        <View style={styles.headerTopRow}>
          {profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
          <View style={styles.headerIdentity}>
            <Text style={styles.name}>{fullName}</Text>
            {profile.location_label ? (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={12} color="#A4C8D8" />
                <Text style={styles.locationText}>{profile.location_label}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.gearButton}
            onPress={() => handleTabChange('settings')}
          >
            <Ionicons name="settings-outline" size={22} color="#999999" />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{profile.total_listings}</Text>
            <Text style={styles.statLabel}>LISTINGS</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{profile.total_sold}</Text>
            <Text style={styles.statLabel}>SOLD</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>{favoritesCount}</Text>
            <Text style={styles.statLabel}>FAVORITES</Text>
          </View>
        </View>

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
          { key: 'listings', label: 'Listings' },
          { key: 'favorites', label: 'Favorites' },
          { key: 'gettoknow', label: 'Get to Know You' },
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
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerIdentity: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 18,
    color: '#1A1A1A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  locationText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  gearButton: {
    padding: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 22,
    color: '#1A1A1A',
  },
  statLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#999999',
    marginTop: 2,
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
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 0.3,
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
