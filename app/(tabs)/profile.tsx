import { useState, useEffect, useRef, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ActionSheet, { ActionSheetOption } from '../../components/ActionSheet';
import { setLikeUpdate } from '../../lib/likeStore';

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
  pre_archive_status: string | null;
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
  like_count: number;
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
        return Math.abs(gestureState.dx) > 20 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2;
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
  const isEmailUser = session?.user?.app_metadata?.provider === 'email';

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
    description?: string;
    options: ActionSheetOption[];
    showCancel?: boolean;
  }>({ visible: false, title: '', description: '', options: [], showCancel: false });

  const [ratingFlow, setRatingFlow] = useState<{
    visible: boolean;
    step: 'buyer_search' | 'rate' | 'confirm' | 'success';
    listing: MyListing | null;
    selectedBuyer: {
      id: string;
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    } | null;
    stars: number;
    selectedTags: string[];
    comment: string;
  }>({
    visible: false,
    step: 'buyer_search',
    listing: null,
    selectedBuyer: null,
    stars: 0,
    selectedTags: [],
    comment: '',
  });

  const [buyerSearchQuery, setBuyerSearchQuery] = useState('');
  const [buyerSearchResults, setBuyerSearchResults] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  }[]>([]);
  const [buyerSearchLoading, setBuyerSearchLoading] = useState(false);
  const [ratingTags, setRatingTags] = useState<{
    id: string;
    tag_key: string;
    label: string;
    sort_order: number;
  }[]>([]);
  const [submittingRating, setSubmittingRating] = useState(false);

  const confettiPieces = Array.from({ length: 52 }, (_, i) => ({
    x: useRef(new Animated.Value(Math.random())).current,
    y: useRef(new Animated.Value(-20)).current,
    opacity: useRef(new Animated.Value(0.6 + Math.random() * 0.4)).current,
    rotate: useRef(new Animated.Value(0)).current,
    width: Math.random() * 10 + 5,
    height: Math.random() * 6 + 4,
    color: ['#A4C8D8', '#7BB8CC', '#C8E6F0', '#5BA3BE', '#E0F3FA'][
      Math.floor(Math.random() * 5)
    ],
  }));
  const checkmarkScale = useRef(new Animated.Value(0)).current;

  const listingsFetched = useRef(false);

  // Tracks close functions for swipeable rows so only one is open at a time
  const rowCloseRefs = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!session) return;
    fetchProfile();
    fetchQuestions();
    fetchRatingTags();
    // Pre-fetch listings since it's the default tab
    if (!listingsFetched.current) {
      listingsFetched.current = true;
      fetchListings();
    }
  }, [session?.user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchProfile();
        fetchListings();
      }
    }, [session?.user?.id])
  );

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
    } else {
      setLikeUpdate({
        listingId: item.id,
        listingType: item.listing_type,
        isLiked: false,
        likeCount: Math.max(0, (item.like_count || 0) - 1),
      });
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

  const fetchRatingTags = async () => {
    const { data } = await supabase
      .from('rating_tags')
      .select('id, tag_key, label, sort_order')
      .eq('is_active', true)
      .order('sort_order');
    if (data) setRatingTags(data);
  };

  const handleBuyerSearch = async (query: string) => {
    setBuyerSearchQuery(query);
    if (query.trim().length < 1) {
      setBuyerSearchResults([]);
      return;
    }
    setBuyerSearchLoading(true);
    const { data } = await supabase
      .from('users')
      .select('id, first_name, last_name, avatar_url')
      .neq('id', session?.user?.id)
      .or(
        `first_name.ilike.%${query}%,last_name.ilike.%${query}%`
      )
      .limit(10);
    setBuyerSearchResults(data || []);
    setBuyerSearchLoading(false);
  };

  const startRatingFlow = (listing: MyListing) => {
    setRatingFlow({
      visible: true,
      step: 'buyer_search',
      listing,
      selectedBuyer: null,
      stars: 1,
      selectedTags: [],
      comment: '',
    });
    setBuyerSearchQuery('');
    setBuyerSearchResults([]);
  };

  const handleSubmitRating = async () => {
    if (!ratingFlow.listing || !ratingFlow.selectedBuyer ||
        ratingFlow.stars === 0 || !session?.user?.id) return;

    setSubmittingRating(true);
    try {
      const listing = ratingFlow.listing;
      const isBuyNothing = listing.listing_type === 'buy_nothing';
      const newStatus = isBuyNothing ? 'claimed' : 'sold';

      // 1. Update listing status
      const table = isBuyNothing ? 'buy_nothing_listings' : 'listings';
      const { error: statusError } = await supabase
        .from(table)
        .update({ status: newStatus })
        .eq('id', listing.id);
      if (statusError) throw statusError;

      // 2. Create rating row
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert({
          listing_id: listing.id,
          listing_type: listing.listing_type,
          seller_id: session.user.id,
          buyer_id: ratingFlow.selectedBuyer.id,
          seller_rating: ratingFlow.stars,
          seller_tags: ratingFlow.selectedTags,
          seller_comment: ratingFlow.comment.trim() || null,
          seller_rated_at: new Date().toISOString(),
        });
      if (ratingError) throw ratingError;

      const sellerName = profile?.first_name || 'Someone';

      // 4. Inject system message if conversation exists
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .eq('listing_id', listing.id)
        .eq('listing_type', listing.listing_type)
        .eq('buyer_id', ratingFlow.selectedBuyer.id)
        .eq('seller_id', session.user.id)
        .maybeSingle();

      if (convData?.id) {
        await supabase.from('messages').insert({
          conversation_id: convData.id,
          sender_id: session.user.id,
          content: `${sellerName} marked this item as ${isBuyNothing ? 'claimed' : 'sold'} and left you a rating. Tap here to confirm the transaction and rate them back. You have 30 days to respond.`,
          message_type: 'system',
        });
      }

      // 5. Update local listings state
      setListings((prev) =>
        prev.map((l) =>
          l.id === listing.id ? { ...l, status: newStatus } : l
        )
      );

      // 6. Show success animation
      setRatingFlow((prev) => ({ ...prev, step: 'success' }));
      triggerSuccessAnimation();
    } catch (err) {
      console.error('Error submitting rating:', err);
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    } finally {
      setSubmittingRating(false);
    }
  };

  const triggerSuccessAnimation = () => {
    // Reset values
    checkmarkScale.setValue(0);
    confettiPieces.forEach((p) => {
      p.y.setValue(-20);
      p.opacity.setValue(0.6 + Math.random() * 0.4);
      p.rotate.setValue(0);
    });

    // Animate checkmark
    Animated.spring(checkmarkScale, {
      toValue: 1,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

    // Animate confetti
    confettiPieces.forEach((p, i) => {
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: 700,
          duration: 1500 + Math.random() * 500,
          delay: i * 30,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 1500 + Math.random() * 500,
          delay: i * 30 + 800,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: Math.random() > 0.5 ? 360 : -360,
          duration: 1500,
          delay: i * 30,
          useNativeDriver: true,
        }),
      ]).start();
    });

    // Auto-close after 2.2 seconds
    setTimeout(() => {
      setRatingFlow((prev) => ({ ...prev, visible: false, step: 'buyer_search' }));
    }, 2200);
  };

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    if (tab === 'listings' && !listingsFetched.current) {
      listingsFetched.current = true;
      fetchListings();
    }
    if (tab === 'favorites') {
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

    setActionSheet({
      visible: true,
      title: 'Profile Photo',
      options: options
        .filter((o) => o.style !== 'cancel')
        .map((o) => ({
          label: o.text,
          destructive: o.style === 'destructive',
          onPress: o.onPress ?? (() => {}),
        })),
    });
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
    setActionSheet({
      visible: true,
      title: 'Sign out',
      showCancel: false,
      options: [
        {
          label: 'Sign out',
          destructive: true,
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/(tabs)/shop');
          },
        },
      ],
    });
  };

  const handleChangePassword = () => {
    if (!session?.user?.email) return;
    setActionSheet({
      visible: true,
      title: 'Change Password',
      description: `We'll send a password reset link to ${session.user.email}.`,
      showCancel: true,
      options: [
        {
          label: 'Send Reset Email',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(
                session.user.email!
              );
              if (error) throw error;
              setActionSheet((prev) => ({ ...prev, visible: false }));
              setTimeout(() => {
                setActionSheet({
                  visible: true,
                  title: 'Email Sent',
                  description: `Check ${session.user.email} for your reset link.`,
                  showCancel: false,
                  options: [
                    {
                      label: 'OK',
                      onPress: () =>
                        setActionSheet((prev) => ({
                          ...prev,
                          visible: false,
                        })),
                    },
                  ],
                });
              }, 300);
            } catch (err) {
              console.error('Error sending password reset:', err);
              setActionSheet((prev) => ({ ...prev, visible: false }));
            }
          },
        },
      ],
    });
  };

  const handleDeleteAccount = () => {
    // Step 1 — warn what will be lost
    setActionSheet({
      visible: true,
      title: 'Delete Account',
      description:
        'This will permanently delete your account, all your listings, and ratings. Your messages will remain visible to other participants but your name will be removed.',
      showCancel: true,
      options: [
        {
          label: 'Continue',
          destructive: true,
          onPress: () => {
            setActionSheet((prev) => ({ ...prev, visible: false }));
            setTimeout(() => {
              // Step 2 — final confirmation
              setActionSheet({
                visible: true,
                title: 'Are you sure?',
                description:
                  'Your account will be permanently deleted. You will be signed out immediately.',
                showCancel: true,
                options: [
                  {
                    label: 'Delete My Account',
                    destructive: true,
                    onPress: async () => {
                      setActionSheet((prev) => ({
                        ...prev,
                        visible: false,
                      }));
                      try {
                        const userId = session?.user?.id;

                        if (userId) {
                          // ── Clean up Storage files ──────────────────
                          // listings bucket: <userId>/<listingId>/<file>
                          try {
                            const { data: listingFolders } =
                              await supabase.storage
                                .from('listings')
                                .list(userId, { limit: 1000 });

                            if (listingFolders && listingFolders.length > 0) {
                              const allListingPaths: string[] = [];
                              for (const folder of listingFolders) {
                                const { data: files } =
                                  await supabase.storage
                                    .from('listings')
                                    .list(`${userId}/${folder.name}`);
                                if (files) {
                                  files.forEach((f) =>
                                    allListingPaths.push(
                                      `${userId}/${folder.name}/${f.name}`
                                    )
                                  );
                                }
                              }
                              if (allListingPaths.length > 0) {
                                await supabase.storage
                                  .from('listings')
                                  .remove(allListingPaths);
                              }
                            }
                          } catch (err) {
                            console.error('Listings storage cleanup error:', err);
                          }

                          // avatars bucket: <userId>/<file>
                          try {
                            const { data: avatarFiles } =
                              await supabase.storage
                                .from('avatars')
                                .list(userId, { limit: 100 });

                            if (avatarFiles && avatarFiles.length > 0) {
                              const avatarPaths = avatarFiles.map(
                                (f) => `${userId}/${f.name}`
                              );
                              await supabase.storage
                                .from('avatars')
                                .remove(avatarPaths);
                            }
                          } catch (err) {
                            console.error('Avatar storage cleanup error:', err);
                          }
                        }

                        // ── Delete account ───────────────────────────
                        const { error } = await supabase.rpc('delete_user');
                        if (error) throw error;
                        // Clear local session without server call
                        // (user no longer exists in auth.users)
                        await supabase.auth.signOut({ scope: 'local' });
                        router.replace('/(tabs)/shop');
                      } catch (err) {
                        console.error('Error deleting account:', err);
                        Alert.alert(
                          'Error',
                          'Could not delete your account. Please try again or contact support.'
                        );
                      }
                    },
                  },
                ],
              });
            }, 300);
          },
        },
      ],
    });
  };

  // ─── Listing card interactions ────────────────────────────
  const handleOpenListing = (listing: { id: string; listing_type: 'listing' | 'buy_nothing' }) => {
    router.push(listingHref(listing));
  };

  const handleLongPressMyListing = (listing: MyListing) => {
    console.log('Long press listing:', { id: listing.id, listing_type: listing.listing_type });
    const isBuyNothing = listing.listing_type === 'buy_nothing';
    const { status } = listing;

    const canArchive = status !== 'archived';
    const canEdit = status !== 'sold' && status !== 'claimed';

    const options: ActionSheetOption[] = [];

    if (canEdit) {
      options.push({
        label: 'Edit listing',
        onPress: () => router.push(`/create-listing?id=${listing.id}&type=${listing.listing_type}`),
      });
    }

    if (status === 'available') {
      options.push({
        label: 'Mark as Pending',
        onPress: () => handleUpdateStatus(listing, 'pending'),
      });
      options.push({
        label: isBuyNothing ? 'Mark as Claimed' : 'Mark as Sold',
        onPress: () => {
          setActionSheet((prev) => ({ ...prev, visible: false }));
          setTimeout(() => startRatingFlow(listing), 300);
        },
      });
    } else if (status === 'pending') {
      options.push({
        label: 'Mark as Available',
        onPress: () => handleUpdateStatus(listing, 'available'),
      });
      options.push({
        label: isBuyNothing ? 'Mark as Claimed' : 'Mark as Sold',
        onPress: () => {
          setActionSheet((prev) => ({ ...prev, visible: false }));
          setTimeout(() => startRatingFlow(listing), 300);
        },
      });
    } else if (status === 'sold') {
      // Terminal status — no further transitions
    } else if (status === 'claimed') {
      // Terminal status — no further transitions
    } else if (status === 'archived') {
      const restoreStatus = listing.pre_archive_status || 'available';
      const restoreLabel = restoreStatus === 'sold'
        ? 'Relist as Sold'
        : restoreStatus === 'claimed'
        ? 'Relist as Claimed'
        : restoreStatus === 'pending'
        ? 'Relist as Pending'
        : 'Relist as Available';
      options.push({
        label: restoreLabel,
        onPress: () => handleUpdateStatus(listing, restoreStatus),
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

    const isArchiving = newStatus === 'archived';
    const isUnarchiving = listing.status === 'archived' && newStatus !== 'archived';

    let updateData: Record<string, any> = { status: newStatus };

    if (isArchiving) {
      // Store current status before archiving
      updateData.pre_archive_status = listing.status;
    }

    if (isUnarchiving) {
      // Clear pre_archive_status after restoring
      updateData.pre_archive_status = null;
    }

    const { error } = await supabase
      .from(table)
      .update(updateData)
      .eq('id', listing.id);

    if (error) {
      console.error('Error updating status:', error);
      Alert.alert('Error', 'Could not update listing status. Please try again.');
      return;
    }

    setListings((prev) =>
      prev.map((l) => {
        if (l.id !== listing.id) return l;
        const patch: Partial<MyListing> = { ...l, status: newStatus };
        if (isArchiving) patch.pre_archive_status = listing.status;
        if (isUnarchiving) patch.pre_archive_status = null;
        return patch as MyListing;
      })
    );
  };

  const handleDeleteListing = (listing: MyListing) => {
    setActionSheet({
      visible: true,
      title: 'Delete this listing?',
      showCancel: false,
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
            ? (item.pre_archive_status || 'available')
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

        {/* Password — email users only */}
        {isEmailUser && (
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={handleChangePassword}
          >
            <Text style={styles.settingsLabel}>Change Password</Text>
            <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
          </TouchableOpacity>
        )}

        <Text style={styles.sectionHeader}>APP</Text>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => router.push('/about')}
        >
          <Text style={styles.settingsLabel}>About Babyly</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => Linking.openURL('https://babylyapp.com/privacy')}
        >
          <Text style={styles.settingsLabel}>Privacy Policy</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => Linking.openURL('https://babylyapp.com/terms')}
        >
          <Text style={styles.settingsLabel}>Terms of Service</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={() => Linking.openURL('https://babylyapp.com/support')}
        >
          <Text style={styles.settingsLabel}>Support</Text>
          <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>DANGER ZONE</Text>

        <TouchableOpacity style={styles.settingsRow} onPress={handleSignOut}>
          <Text style={[styles.settingsLabel, styles.signOutText]}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.settingsRow}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.settingsLabel, styles.deleteAccountText]}>
            Delete Account
          </Text>
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
        {profile.rating_count > 0 ? (
          <TouchableOpacity
            style={styles.ratingsRow}
            onPress={() => router.push(`/profile/${session?.user?.id}`)}
            activeOpacity={0.7}
          >
            <View style={styles.ratingsStars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={
                    s <= Math.round(profile.avg_rating ?? 0)
                      ? 'star'
                      : 'star-outline'
                  }
                  size={14}
                  color="#FFB800"
                />
              ))}
            </View>
            <Text style={styles.ratingAvgText}>
              {profile.avg_rating?.toFixed(1)}
            </Text>
            <Text style={styles.ratingCountText}>
              ({profile.rating_count})
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push(`/profile/${session?.user?.id}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.ratingNoneText}>No ratings yet</Text>
          </TouchableOpacity>
        )}

      </View>

      <View style={styles.headerDivider} />

      {/* ───── Tab Switcher ───── */}
      <View style={styles.tabBar}>
        {([
          { key: 'listings', label: 'Listings' },
          { key: 'favorites', label: 'Favorites' },
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
        description={actionSheet.description}
        options={actionSheet.options}
        showCancel={actionSheet.showCancel}
        onClose={() => setActionSheet((prev) => ({ ...prev, visible: false }))}
      />

      {/* ───── Rating Flow Modal ───── */}
      <Modal
        visible={ratingFlow.visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          if (!submittingRating) {
            setRatingFlow((prev) => ({ ...prev, visible: false }));
          }
        }}
      >
        <SafeAreaView style={styles.ratingModal} edges={['top']}>
          {/* Header — hidden during success animation */}
          {ratingFlow.step !== 'success' && (
          <View style={styles.ratingModalHeader}>
            {ratingFlow.step !== 'buyer_search' ? (
              <TouchableOpacity
                onPress={() => setRatingFlow((prev) => ({
                  ...prev,
                  step: prev.step === 'confirm' ? 'rate' : 'buyer_search',
                }))}
              >
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setRatingFlow((prev) => ({ ...prev, visible: false }))}
              >
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            <Text style={styles.ratingModalTitle}>
              {ratingFlow.step === 'buyer_search' ? 'Who bought this?' :
               ratingFlow.step === 'rate' ? 'Share your feedback' :
               ratingFlow.step === 'confirm' ? 'Confirm & Submit' :
               ''}
            </Text>
            <View style={{ width: 24 }} />
          </View>
          )}

          {/* Step: Buyer Search */}
          {ratingFlow.step === 'buyer_search' && (
            <View style={{ flex: 1 }}>
              <View style={styles.buyerSearchContainer}>
                <View style={styles.buyerSearchInputRow}>
                  <Ionicons name="search-outline" size={18} color="#999999" />
                  <TextInput
                    style={styles.buyerSearchInput}
                    placeholder="Search by name..."
                    placeholderTextColor="#BBBBBB"
                    value={buyerSearchQuery}
                    onChangeText={handleBuyerSearch}
                    autoFocus
                  />
                  {buyerSearchLoading && (
                    <ActivityIndicator size="small" color="#A4C8D8" />
                  )}
                </View>
              </View>
              <FlatList
                data={buyerSearchResults}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.buyerResultRow}
                    onPress={() => {
                      setRatingFlow((prev) => ({
                        ...prev,
                        selectedBuyer: item,
                        step: 'rate',
                      }));
                    }}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={styles.buyerResultAvatar}
                      />
                    ) : (
                      <View style={[styles.buyerResultAvatar, styles.buyerResultAvatarPlaceholder]}>
                        <Text style={styles.buyerResultInitials}>
                          {item.first_name[0]}{item.last_name?.[0] || ''}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.buyerResultName}>
                      {item.first_name} {item.last_name}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#CCCCCC" />
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  buyerSearchQuery.length >= 1 && !buyerSearchLoading ? (
                    <View style={styles.buyerSearchEmpty}>
                      <Ionicons name="person-outline" size={40} color="#CCCCCC" />
                      <Text style={styles.buyerSearchEmptyTitle}>
                        No one found
                      </Text>
                      <Text style={styles.buyerSearchEmptyText}>
                        Try searching by first or last name
                      </Text>
                    </View>
                  ) : buyerSearchQuery.length < 1 ? (
                    <View style={styles.buyerSearchEmpty}>
                      <Ionicons name="search-outline" size={40} color="#CCCCCC" />
                      <Text style={styles.buyerSearchEmptyTitle}>
                        Find your buyer
                      </Text>
                      <Text style={styles.buyerSearchEmptyText}>
                        Search for the person you sold to
                      </Text>
                    </View>
                  ) : null
                }
              />
            </View>
          )}

          {/* Step: Rate */}
          {ratingFlow.step === 'rate' && ratingFlow.selectedBuyer && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.ratingStepContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* Stars */}
              <Text style={styles.ratingLabel}>Your rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() =>
                      setRatingFlow((prev) => ({ ...prev, stars: star }))
                    }
                  >
                    <Ionicons
                      name={star <= ratingFlow.stars ? 'star' : 'star-outline'}
                      size={36}
                      color="#FFB800"
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Tags */}
              <Text style={styles.ratingLabel}>
                Add tags <Text style={styles.ratingOptional}>(optional)</Text>
              </Text>
              <View style={styles.tagsGrid}>
                {ratingTags.map((tag) => {
                  const selected = ratingFlow.selectedTags.includes(tag.tag_key);
                  return (
                    <TouchableOpacity
                      key={tag.tag_key}
                      style={[
                        styles.tagPill,
                        selected && styles.tagPillSelected,
                      ]}
                      onPress={() => {
                        setRatingFlow((prev) => ({
                          ...prev,
                          selectedTags: selected
                            ? prev.selectedTags.filter((t) => t !== tag.tag_key)
                            : [...prev.selectedTags, tag.tag_key],
                        }));
                      }}
                    >
                      <Text
                        style={[
                          styles.tagPillText,
                          selected && styles.tagPillTextSelected,
                        ]}
                      >
                        {tag.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Comment */}
              <Text style={styles.ratingLabel}>
                Leave a comment{' '}
                <Text style={styles.ratingOptional}>(optional)</Text>
              </Text>
              <TextInput
                style={styles.ratingCommentInput}
                placeholder="Share your experience..."
                placeholderTextColor="#BBBBBB"
                value={ratingFlow.comment}
                onChangeText={(text) =>
                  setRatingFlow((prev) => ({ ...prev, comment: text }))
                }
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={500}
              />

              {/* Next button */}
              <TouchableOpacity
                style={[
                  styles.ratingNextButton,
                  false && styles.ratingNextButtonDisabled,
                ]}
                disabled={false}
                onPress={() =>
                  setRatingFlow((prev) => ({ ...prev, step: 'confirm' }))
                }
              >
                <Text style={styles.ratingNextButtonText}>Continue</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Step: Confirm */}
          {ratingFlow.step === 'confirm' && ratingFlow.selectedBuyer && (
            <View style={styles.ratingStepContent}>
              <Text style={styles.confirmTitle}>
                Ready to submit?
              </Text>
              <Text style={styles.confirmBody}>
                You are about to mark{' '}
                <Text style={styles.confirmBold}>
                  {ratingFlow.listing?.title}
                </Text>{' '}
                as{' '}
                {ratingFlow.listing?.listing_type === 'buy_nothing'
                  ? 'claimed'
                  : 'sold'}{' '}
                to{' '}
                <Text style={styles.confirmBold}>
                  {ratingFlow.selectedBuyer.first_name}{' '}
                  {ratingFlow.selectedBuyer.last_name}
                </Text>
                . You cannot undo this.{'\n\n'}
                {ratingFlow.selectedBuyer.first_name} will be invited to
                rate you, at which point both ratings will be visible to
                other users.
              </Text>

              {/* Rating summary */}
              <View style={styles.confirmSummary}>
                <View style={styles.confirmStarsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= ratingFlow.stars ? 'star' : 'star-outline'}
                      size={20}
                      color="#FFB800"
                    />
                  ))}
                </View>
                {ratingFlow.selectedTags.length > 0 && (
                  <Text style={styles.confirmTags}>
                    {ratingFlow.selectedTags
                      .map(
                        (key) =>
                          ratingTags.find((t) => t.tag_key === key)?.label
                      )
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
                {ratingFlow.comment.trim() && (
                  <Text style={styles.confirmComment}>
                    "{ratingFlow.comment.trim()}"
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.ratingNextButton}
                onPress={handleSubmitRating}
                disabled={submittingRating}
              >
                {submittingRating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.ratingNextButtonText}>
                    Confirm & Submit
                  </Text>
                )}
              </TouchableOpacity>

            </View>
          )}

          {/* Step: Success */}
          {ratingFlow.step === 'success' && ratingFlow.listing && (
            <View style={styles.successContainer}>
              {/* Confetti */}
              {confettiPieces.map((piece, i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.confettiPiece,
                    {
                      left: `${piece.x._value * 100}%`,
                      width: piece.width,
                      height: piece.height,
                      backgroundColor: piece.color,
                      transform: [
                        { translateY: piece.y },
                        {
                          rotate: piece.rotate.interpolate({
                            inputRange: [-360, 360],
                            outputRange: ['-360deg', '360deg'],
                          }),
                        },
                      ],
                      opacity: piece.opacity,
                    },
                  ]}
                />
              ))}

              {/* Checkmark */}
              <Animated.View
                style={[
                  styles.successCheckmark,
                  { transform: [{ scale: checkmarkScale }] },
                ]}
              >
                <Ionicons name="checkmark" size={52} color="#FFFFFF" />
              </Animated.View>

              {/* Text */}
              <Text style={styles.successTitle}>
                {ratingFlow.listing.listing_type === 'buy_nothing'
                  ? 'Claimed!'
                  : 'Sold!'}
              </Text>
              <Text style={styles.successSubtitle}>
                Your rating has been submitted
              </Text>
            </View>
          )}
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
    marginTop: 4,
  },
  ratingsStars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingAvgText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
  },
  ratingCountText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  ratingNoneText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#CCCCCC',
    marginTop: 4,
    textAlign: 'center',
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
    borderRadius: 12,
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
  deleteAccountText: {
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
  ratingModal: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  ratingModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  ratingModalTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  buyerSearchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  buyerSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  buyerSearchInput: {
    flex: 1,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
  },
  buyerResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  buyerResultAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  buyerResultAvatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerResultInitials: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  buyerResultName: {
    flex: 1,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
  },
  buyerSearchEmpty: {
    padding: 32,
    alignItems: 'center',
  },
  buyerSearchEmptyTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  buyerSearchEmptyText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  successCheckmark: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 32,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  successSubtitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#999999',
  },
  ratingStepContent: {
    padding: 24,
  },
  ratingLabel: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 12,
    marginTop: 20,
  },
  ratingOptional: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  tagPillSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#EBF5F9',
  },
  tagPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  tagPillTextSelected: {
    color: '#A4C8D8',
  },
  ratingCommentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 90,
    marginBottom: 4,
  },
  ratingNextButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ratingNextButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  ratingNextButtonText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  confirmIconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
  },
  confirmBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmBold: {
    fontFamily: 'Quicksand_700Bold',
    color: '#1A1A1A',
  },
  confirmSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 8,
  },
  confirmStarsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  confirmTags: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#666666',
  },
  confirmComment: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
  },
});
