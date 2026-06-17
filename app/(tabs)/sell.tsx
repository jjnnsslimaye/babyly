import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Keyboard,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import DragList, { DragListRenderItemInfo } from 'react-native-draglist';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_HEIGHT = SCREEN_WIDTH * 1.0;

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

type ListingForm = {
  listingType: 'shop' | 'buy_nothing' | null;
  photos: string[];
  video: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  attributes: Record<string, string>;
  title: string;
  description: string;
  brandId: string | null;
  condition: string | null;
  price: string;
  paymentMethods: string[];
  location: string | null;
  locationLabel: string | null;
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

const CONDITION_LABELS = [
  { label: 'New (with tags)', value: 'new_unopened', description: 'Never used, tags still on' },
  { label: 'Like New', value: 'like_new', description: 'Used once or twice, no visible wear' },
  { label: 'Gently Used', value: 'gently_used', description: 'Some signs of use, fully functional' },
  { label: 'Used', value: 'used', description: 'Visible wear but still works great' },
];

const PAYMENT_METHODS = ['Cash', 'Venmo', 'Zelle', 'PayPal', 'Apple Pay', 'Facebook Pay'];

export default function Sell() {
  const { session, loadingSession } = useAuth();
  const router = useRouter();

  const [currentStep, setCurrentStep] = useState(1);
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryAttributes, setCategoryAttributes] = useState<CategoryAttribute[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [brandSearch, setBrandSearch] = useState('');
  const [reviewCarouselIndex, setReviewCarouselIndex] = useState(0);

  const [locationZip, setLocationZip] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [form, setForm] = useState<ListingForm>({
    listingType: null,
    photos: [],
    video: null,
    categoryId: null,
    subcategoryId: null,
    attributes: {},
    title: '',
    description: '',
    brandId: null,
    condition: null,
    price: '',
    paymentMethods: [],
    location: null,
    locationLabel: null,
  });

  const videoPlayer = useVideoPlayer(form.video ? { uri: form.video } : null, player => {
    if (player) {
      player.loop = true;
      player.muted = true;
    }
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loadingSession && !session) {
      router.replace('/login');
    }
  }, [session, loadingSession]);

  // Load data on mount
  useEffect(() => {
    if (!session) return;

    const loadData = async () => {
      try {
        const [userResult, categoriesResult, attributesResult, brandsResult] = await Promise.all([
          supabase.from('users').select('location, location_label').eq('id', session.user.id).single(),
          supabase.from('categories').select('id, parent_id, name, slug, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from('category_attributes').select('category_id, attribute_key, attribute_value, sort_order').eq('is_active', true).order('sort_order'),
          supabase.from('brands').select('id, name, slug').eq('is_active', true).order('name'),
        ]);

        if (userResult.data) {
          setForm(prev => ({
            ...prev,
            location: userResult.data.location,
            locationLabel: userResult.data.location_label,
          }));
        }

        if (categoriesResult.data) setCategories(categoriesResult.data);
        if (attributesResult.data) setCategoryAttributes(attributesResult.data);
        if (brandsResult.data) setBrands(brandsResult.data);

        setLoadingData(false);
      } catch (err) {
        console.error('Error loading data:', err);
        setLoadingData(false);
      }
    };

    loadData();
  }, [session]);

  const geocodeZip = async (zip: string) => {
    if (zip.length !== 5) return;
    setLocationLoading(true);
    setLocationError('');
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&addressdetails=1&limit=1`,
        { headers: { 'User-Agent': 'Babyly/1.0' } }
      );
      const results = await response.json();
      if (results.length > 0) {
        const { lat, lon } = results[0];
        const address = results[0].address;
        const city = address.city || address.town || address.village || address.county || '';
        const state = address.state || '';
        const stateAbbr = US_STATE_ABBREVIATIONS[state] || state;
        const locationLabel = city && stateAbbr ? `${city}, ${stateAbbr}` : city || stateAbbr;
        setForm(prev => ({
          ...prev,
          location: `SRID=4326;POINT(${lon} ${lat})`,
          locationLabel,
        }));
      } else {
        setLocationError('Zip code not found.');
      }
    } catch (err) {
      setLocationError('Could not look up zip code.');
    } finally {
      setLocationLoading(false);
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      router.back();
    } else if (currentStep === 4) {
      setCurrentStep(3);
    } else if (currentStep === 5) {
      const selectedCategory = categories.find(c => c.id === form.categoryId);
      if (selectedCategory?.slug === 'gear' && form.subcategoryId) {
        setCurrentStep(4);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 6) {
      const selectedCategory = categories.find(c => c.id === form.categoryId);
      if (selectedCategory?.slug === 'gear' && form.subcategoryId) {
        setCurrentStep(4);
      } else {
        setCurrentStep(3);
      }
    } else if (currentStep === 8) {
      if (hasAttributes) {
        setCurrentStep(7);
      } else {
        setCurrentStep(6);
      }
    } else if (currentStep === 9) {
      if (form.listingType === 'buy_nothing') {
        if (hasAttributes) {
          setCurrentStep(7);
        } else {
          setCurrentStep(6);
        }
      } else {
        setCurrentStep(8);
      }
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    if (currentStep === 3) {
      const selectedCategory = categories.find(c => c.id === form.categoryId);
      if (selectedCategory?.slug === 'gear') {
        setCurrentStep(4);
      } else {
        setCurrentStep(5);
      }
    } else if (currentStep === 4) {
      setCurrentStep(5);
    } else if (currentStep === 6) {
      if (hasAttributes) {
        setCurrentStep(7);
      } else if (form.listingType === 'buy_nothing') {
        setCurrentStep(9);
      } else {
        setCurrentStep(8);
      }
    } else if (currentStep === 7) {
      if (form.listingType === 'buy_nothing') {
        setCurrentStep(9);
      } else {
        setCurrentStep(8);
      }
    } else if (currentStep === 8) {
      setCurrentStep(9);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const isContinueEnabled = () => {
    switch (currentStep) {
      case 1: return form.listingType !== null;
      case 2: return form.photos.length > 0;
      case 3: return form.categoryId !== null;
      case 4: return form.subcategoryId !== null;
      case 5: return form.title.trim() !== '' && form.description.trim() !== '';
      case 6: return form.condition !== null;
      case 7: return true;
      case 8: return parseFloat(form.price) > 0;
      case 9: return true;
      default: return false;
    }
  };

  const handlePickPhotos = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access photos is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 10 - form.photos.length,
    });

    if (!result.canceled) {
      const newPhotos = result.assets.map(asset => asset.uri);
      setForm(prev => ({
        ...prev,
        photos: [...prev.photos, ...newPhotos].slice(0, 10),
      }));
      setError('');
    }
  };

  const handleRemovePhoto = (index: number) => {
    setForm(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  const handleChooseVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setError('Permission to access library is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });

    if (!result.canceled) {
      setForm(prev => ({ ...prev, video: result.assets[0].uri }));
      setError('');
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    setForm(prev => ({ ...prev, categoryId, subcategoryId: null, attributes: {} }));
  };

  const handleSelectSubcategory = (subcategoryId: string) => {
    setForm(prev => ({ ...prev, subcategoryId, attributes: {} }));
  };

  const handleSelectAttribute = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      attributes: { ...prev.attributes, [key]: value },
    }));
  };

  const handleTogglePaymentMethod = (method: string) => {
    setForm(prev => ({
      ...prev,
      paymentMethods: prev.paymentMethods.includes(method)
        ? prev.paymentMethods.filter(m => m !== method)
        : [...prev.paymentMethods, method],
    }));
  };

  const handleSubmit = async () => {
    if (!session) return;

    setSubmitting(true);
    setError('');

    try {
      const listingId = Crypto.randomUUID();
      const userId = session.user.id;

      // Upload photos
      const photoUrls: string[] = [];
      for (let i = 0; i < form.photos.length; i++) {
        const photoUri = form.photos[i];
        const base64 = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const arrayBuffer = decode(base64);
        const timestamp = Date.now();
        const filePath = `${userId}/${listingId}/${timestamp}-${i}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('listings')
          .upload(filePath, arrayBuffer, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('listings')
          .getPublicUrl(filePath);

        photoUrls.push(publicUrl);
      }

      // Upload video if present
      let videoUrl: string | null = null;
      if (form.video) {
        const base64 = await FileSystem.readAsStringAsync(form.video, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const arrayBuffer = decode(base64);
        const timestamp = Date.now();
        const filePath = `${userId}/${listingId}/${timestamp}-video.mp4`;

        const { error: uploadError } = await supabase.storage
          .from('listings')
          .upload(filePath, arrayBuffer, { contentType: 'video/mp4' });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('listings')
          .getPublicUrl(filePath);

        videoUrl = publicUrl;
      }

      // Insert listing
      const listingData: any = {
        id: listingId,
        seller_id: userId,
        category_id: form.subcategoryId || form.categoryId,
        title: form.title.trim(),
        description: form.description.trim(),
        condition: form.condition,
        brand_id: form.brandId,
        location: form.location,
        location_label: form.locationLabel,
        cover_photo_url: photoUrls[0],
        attributes: form.attributes,
        status: 'available',
      };

      if (form.listingType === 'shop') {
        listingData.price = parseFloat(form.price);
        listingData.payment_methods = form.paymentMethods;
        const { error: insertError } = await supabase.from('listings').insert(listingData);
        if (insertError) throw insertError;
      } else {
        const { error: insertError } = await supabase.from('buy_nothing_listings').insert(listingData);
        if (insertError) throw insertError;
      }

      // Insert media rows
      const mediaRows = photoUrls.map((url, index) => ({
        listing_id: listingId,
        listing_type: form.listingType === 'shop' ? 'listing' : 'buy_nothing',
        url,
        media_type: 'photo',
        sort_order: index,
        is_cover: index === 0,
      }));

      if (videoUrl) {
        mediaRows.push({
          listing_id: listingId,
          listing_type: form.listingType === 'shop' ? 'listing' : 'buy_nothing',
          url: videoUrl,
          media_type: 'video',
          sort_order: photoUrls.length,
          is_cover: false,
        });
      }

      const { error: mediaError } = await supabase.from('listing_media').insert(mediaRows);
      if (mediaError) throw mediaError;

      router.replace(`/listing/${listingId}?type=${form.listingType}`);
    } catch (err: any) {
      console.error('Error submitting listing:', err);
      setError(err.message || 'Failed to post listing. Please try again.');
      setSubmitting(false);
    }
  };

  const renderReviewStep = () => {
    const mediaItems = [
      ...form.photos.map((uri, index) => ({ uri, type: 'photo' as const, key: `photo-${index}` })),
      ...(form.video ? [{ uri: form.video, type: 'video' as const, key: 'video-0' }] : []),
    ];
    const categoryName = categories.find(c => c.id === (form.subcategoryId || form.categoryId))?.name || '';
    const conditionLabel = CONDITION_LABELS.find(c => c.value === form.condition)?.label || '';
    const sellerFirstName = session?.user?.user_metadata?.full_name?.split(' ')[0] || 'You';

    return (
      <View style={styles.reviewContainer}>
        {/* Carousel */}
        <View style={styles.reviewCarouselContainer}>
          <FlatList
            data={mediaItems}
            renderItem={({ item }) => (
              <View style={styles.reviewCarouselItem}>
                {item.type === 'photo' ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={styles.reviewCarouselImage}
                    resizeMode="cover"
                  />
                ) : (
                  <VideoView
                    style={[styles.reviewCarouselImage, { width: SCREEN_WIDTH, height: CAROUSEL_HEIGHT }]}
                    player={videoPlayer}
                    contentFit="cover"
                    nativeControls={true}
                  />
                )}
              </View>
            )}
            keyExtractor={(item) => item.key}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={({ viewableItems }) => {
              if (viewableItems.length > 0) {
                setReviewCarouselIndex(viewableItems[0].index || 0);
              }
            }}
            viewabilityConfig={{ minimumViewTime: 100, viewAreaCoveragePercentThreshold: 50 }}
          />
          {mediaItems.length > 1 && (
            <View style={styles.reviewPaginationContainer}>
              {mediaItems.map((_, i) => (
                <View
                  key={i}
                  style={[styles.reviewPaginationDot, i === reviewCarouselIndex && styles.reviewPaginationDotActive]}
                />
              ))}
            </View>
          )}

          {/* Floating back button over carousel */}
          <TouchableOpacity
            style={styles.reviewFloatingBack}
            onPress={handleBack}
          >
            <Ionicons name="arrow-back" size={22} color="#1A1A1A" />
          </TouchableOpacity>
        </View>

        {/* Scrollable content */}
        <ScrollView contentContainerStyle={styles.reviewScrollContent}>
          {/* Title and Price */}
          <View style={styles.reviewTitlePriceRow}>
            <Text style={styles.reviewTitle}>{form.title}</Text>
            {form.listingType === 'shop' ? (
              <Text style={styles.reviewPrice}>${parseFloat(form.price || '0').toFixed(2)}</Text>
            ) : (
              <View style={styles.reviewFreeBadge}>
                <Text style={styles.reviewFreeText}>FREE</Text>
              </View>
            )}
          </View>

          {/* Category and Condition */}
          <Text style={styles.reviewCategoryConditionText}>
            {categoryName.toUpperCase()} • {conditionLabel.toUpperCase()}
          </Text>

          <View style={styles.reviewDivider} />

          {/* Description */}
          <Text style={styles.reviewSectionLabel}>DESCRIPTION</Text>
          <Text style={styles.reviewDescriptionText}>{form.description}</Text>

          <View style={styles.reviewDivider} />

          {/* Seller */}
          <Text style={styles.reviewSectionLabel}>SELLER</Text>
          <View style={styles.reviewSellerRow}>
            <View style={styles.reviewAvatar}>
              <Text style={styles.reviewAvatarInitials}>
                {sellerFirstName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.reviewSellerInfo}>
              <Text style={styles.reviewSellerName}>You (preview)</Text>
              <Text style={styles.reviewSellerMeta}>{form.locationLabel}</Text>
            </View>
          </View>

          <View style={styles.reviewDivider} />

          {/* Pickup Location */}
          <Text style={styles.reviewSectionLabel}>PICKUP LOCATION</Text>
          <View style={styles.reviewLocationRow}>
            <Ionicons name="location-outline" size={14} color="#A4C8D8" />
            <Text style={styles.reviewLocationText}>{form.locationLabel}</Text>
          </View>

          <View style={styles.reviewDivider} />

          {/* Details */}
          <Text style={styles.reviewSectionLabel}>DETAILS</Text>
          <View style={styles.reviewDetailsContainer}>
            {form.brandId && (
              <View style={styles.reviewDetailRow}>
                <Text style={styles.reviewDetailLabel}>Brand</Text>
                <Text style={styles.reviewDetailValue}>
                  {brands.find(b => b.id === form.brandId)?.name}
                </Text>
              </View>
            )}
            {form.listingType === 'shop' && form.paymentMethods.length > 0 && (
              <View style={styles.reviewPaymentMethodsContainer}>
                <Text style={styles.reviewDetailLabel}>Accepted payments</Text>
                <View style={styles.reviewPaymentPills}>
                  {form.paymentMethods.map((method, index) => (
                    <View key={index} style={styles.reviewPaymentPill}>
                      <Text style={styles.reviewPaymentPillText}>{method}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {Object.entries(form.attributes).map(([key, value]) => (
              <View key={key} style={styles.reviewDetailRow}>
                <Text style={styles.reviewDetailLabel}>
                  {key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                </Text>
                <Text style={styles.reviewDetailValue}>{value}</Text>
              </View>
            ))}
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </View>
    );
  };

  if (loadingSession || loadingData) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#A4C8D8" style={styles.loader} />
      </SafeAreaView>
    );
  }

  const progressPercent = (currentStep / 9) * 100;
  const topLevelCategories = categories.filter(c => c.parent_id === null);
  const gearSubcategories = categories.filter(c => {
    const gearCategory = categories.find(cat => cat.slug === 'gear');
    return c.parent_id === gearCategory?.id;
  });

  const currentCategoryId = form.subcategoryId || form.categoryId;
  const attributesByKey: Record<string, CategoryAttribute[]> = {};
  if (currentCategoryId) {
    categoryAttributes
      .filter(a => a.category_id === currentCategoryId)
      .forEach(attr => {
        if (!attributesByKey[attr.attribute_key]) {
          attributesByKey[attr.attribute_key] = [];
        }
        attributesByKey[attr.attribute_key].push(attr);
      });
  }
  const hasAttributes = Object.keys(attributesByKey).length > 0;

  const filteredBrands = brandSearch.trim().length > 0
    ? brands.filter(b => b.name.toLowerCase().includes(brandSearch.toLowerCase()))
    : brands;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {currentStep !== 9 && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
        )}

        {currentStep !== 9 && (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
            </TouchableOpacity>
          </View>
        )}

        {currentStep === 9 ? (
          <>
            {renderReviewStep()}
            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.continueButton, submitting && styles.continueButtonDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.continueButtonText}>Post listing</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {currentStep === 1 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>What are you doing?</Text>
                  <View style={styles.listingTypeContainer}>
                    <TouchableOpacity
                      style={[
                        styles.listingTypeCard,
                        form.listingType === 'shop' && styles.listingTypeCardSelected,
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, listingType: 'shop' }))}
                    >
                      <Ionicons name="bag-outline" size={48} color={form.listingType === 'shop' ? '#A4C8D8' : '#999999'} />
                      <Text style={[styles.listingTypeText, form.listingType === 'shop' && styles.listingTypeTextSelected]}>
                        Selling
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.listingTypeCard,
                        form.listingType === 'buy_nothing' && styles.listingTypeCardSelected,
                      ]}
                      onPress={() => setForm(prev => ({ ...prev, listingType: 'buy_nothing' }))}
                    >
                      <Ionicons name="gift-outline" size={48} color={form.listingType === 'buy_nothing' ? '#A4C8D8' : '#999999'} />
                      <Text style={[styles.listingTypeText, form.listingType === 'buy_nothing' && styles.listingTypeTextSelected]}>
                        Giving Away
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {currentStep === 2 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>Show us what you've got</Text>
                  <View style={styles.mediaSectionHeader}>
                    <Text style={styles.videoSectionTitle}>Add photos</Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>
                  <Text style={styles.stepSubtitle}>All the best angles.</Text>

                  {form.photos.length === 0 ? (
                    <View style={styles.addPhotosContainer}>
                      <TouchableOpacity style={styles.addPhotosButton} onPress={handlePickPhotos}>
                        <Ionicons name="add" size={32} color="#A4C8D8" />
                      </TouchableOpacity>
                      <Text style={styles.addPhotosHint}>Tap to add photos</Text>
                    </View>
                  ) : (
                    <View>
                      <DragList
                        data={form.photos.map((uri, index) => ({ uri, key: `photo-${index}-${uri}` }))}
                        keyExtractor={(item) => item.key}
                        horizontal
                        onReordered={async (fromIndex, toIndex) => {
                          const newPhotos = [...form.photos];
                          const [moved] = newPhotos.splice(fromIndex, 1);
                          newPhotos.splice(toIndex, 0, moved);
                          setForm(prev => ({ ...prev, photos: newPhotos }));
                        }}
                        renderItem={({ item, onDragStart, onDragEnd, isActive, index }: DragListRenderItemInfo<{ uri: string; key: string }>) => (
                          <TouchableOpacity
                            key={item.key}
                            style={[
                              styles.photoThumbnailContainer,
                              isActive && styles.dragActiveOverlay,
                            ]}
                            onLongPress={onDragStart}
                            onPressOut={onDragEnd}
                            delayLongPress={200}
                          >
                            <Image source={{ uri: item.uri }} style={styles.photoThumbnail} />
                            {index === 0 && (
                              <View style={styles.coverBadge}>
                                <Text style={styles.coverBadgeText}>COVER</Text>
                              </View>
                            )}
                            <TouchableOpacity
                              style={styles.removePhotoButton}
                              onPress={() => handleRemovePhoto(index ?? 0)}
                            >
                              <Ionicons name="close" size={16} color="#fff" />
                            </TouchableOpacity>
                          </TouchableOpacity>
                        )}
                        contentContainerStyle={styles.photoScrollContent}
                        showsHorizontalScrollIndicator={false}
                        ListFooterComponent={
                          form.photos.length < 10 ? (
                            <TouchableOpacity style={styles.addMorePhotosButton} onPress={handlePickPhotos}>
                              <Ionicons name="add" size={32} color="#A4C8D8" />
                            </TouchableOpacity>
                          ) : null
                        }
                      />
                      <Text style={styles.dragHint}>Hold and drag to rearrange · Limit 10</Text>
                    </View>
                  )}

                  <View style={styles.videoSection}>
                    <Text style={styles.videoSectionTitle}>Add a video</Text>
                    <Text style={styles.videoSubtitle}>Optional. Show the item in action.</Text>

                    {!form.video ? (
                      <View>
                        <TouchableOpacity style={styles.addVideosButton} onPress={handleChooseVideo}>
                          <Ionicons name="add" size={48} color="#A4C8D8" />
                        </TouchableOpacity>
                        <Text style={styles.addPhotosHint}>Tap to add a video</Text>
                      </View>
                    ) : (
                      <View style={styles.videoPreviewContainer}>
                        <VideoView
                          style={styles.videoPreview}
                          player={videoPlayer}
                          contentFit="cover"
                          nativeControls={true}
                        />
                        <TouchableOpacity
                          style={styles.removeVideoButton}
                          onPress={() => setForm(prev => ({ ...prev, video: null }))}
                        >
                          <Ionicons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {currentStep === 3 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>What are you listing?</Text>
                  {topLevelCategories.map(category => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.categoryRow,
                        form.categoryId === category.id && styles.categoryRowSelected,
                      ]}
                      onPress={() => handleSelectCategory(category.id)}
                    >
                      <Text style={[styles.categoryText, form.categoryId === category.id && styles.categoryTextSelected]}>
                        {category.name}
                      </Text>
                      {form.categoryId === category.id && (
                        <Ionicons name="checkmark" size={24} color="#A4C8D8" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {currentStep === 4 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>What type of gear?</Text>
                  {gearSubcategories.map(subcategory => (
                    <TouchableOpacity
                      key={subcategory.id}
                      style={[
                        styles.categoryRow,
                        form.subcategoryId === subcategory.id && styles.categoryRowSelected,
                      ]}
                      onPress={() => handleSelectSubcategory(subcategory.id)}
                    >
                      <Text style={[styles.categoryText, form.subcategoryId === subcategory.id && styles.categoryTextSelected]}>
                        {subcategory.name}
                      </Text>
                      {form.subcategoryId === subcategory.id && (
                        <Ionicons name="checkmark" size={24} color="#A4C8D8" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {currentStep === 5 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>Describe your item</Text>

                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>TITLE</Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Title (e.g. UPPAbaby Vista V2 Stroller)"
                    placeholderTextColor="#CCCCCC"
                    value={form.title}
                    onChangeText={(text) => setForm(prev => ({ ...prev, title: text }))}
                    editable={!submitting}
                  />

                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>DESCRIPTION</Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Description (condition, accessories, etc.)"
                    placeholderTextColor="#CCCCCC"
                    value={form.description}
                    onChangeText={(text) => setForm(prev => ({ ...prev, description: text }))}
                    multiline
                    editable={!submitting}
                  />

                  {/* Brand picker trigger */}
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>BRAND</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.brandPickerRow}
                    onPress={() => setBrandModalVisible(true)}
                    disabled={submitting}
                  >
                    <Text style={[
                      styles.brandPickerText,
                      form.brandId && styles.brandPickerTextSelected
                    ]}>
                      {form.brandId
                        ? brands.find(b => b.id === form.brandId)?.name || 'Select a brand'
                        : 'Select a brand (optional)'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#999999" />
                  </TouchableOpacity>

                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>PICKUP LOCATION</Text>
                  </View>
                  <View style={styles.locationInputContainer}>
                    <Ionicons name="location-outline" size={18} color="#A4C8D8" style={styles.locationIcon} />
                    <TextInput
                      style={styles.locationZipInput}
                      placeholder={form.locationLabel || 'Enter zip code'}
                      placeholderTextColor={form.locationLabel ? '#1A1A1A' : '#CCCCCC'}
                      value={locationZip}
                      onChangeText={(text) => {
                        setLocationZip(text);
                        setLocationError('');
                        if (text.length === 5) {
                          geocodeZip(text);
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={5}
                      editable={!submitting}
                    />
                    {locationLoading ? (
                      <ActivityIndicator size="small" color="#A4C8D8" />
                    ) : form.locationLabel && locationZip.length === 0 ? (
                      <Ionicons name="checkmark-circle" size={20} color="#34C759" />
                    ) : null}
                  </View>
                  {form.locationLabel && locationZip.length > 0 && (
                    <Text style={styles.locationResolvedText}>{form.locationLabel}</Text>
                  )}
                  {locationError ? (
                    <Text style={styles.locationErrorText}>{locationError}</Text>
                  ) : null}

                  {/* Brand modal */}
                  <Modal
                    visible={brandModalVisible}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => {
                      Keyboard.dismiss();
                      setBrandModalVisible(false);
                    }}
                  >
                    <SafeAreaView style={styles.brandModalContainer}>
                      {/* Modal header */}
                      <View style={styles.brandModalHeader}>
                        <Text style={styles.brandModalTitle}>Select a brand</Text>
                        <TouchableOpacity onPress={() => {
                          Keyboard.dismiss();
                          setBrandModalVisible(false);
                          setBrandSearch('');
                        }}>
                          <Ionicons name="close" size={24} color="#1A1A1A" />
                        </TouchableOpacity>
                      </View>

                      {/* Search input */}
                      <View style={styles.brandSearchContainer}>
                        <Ionicons name="search-outline" size={20} color="#999999" />
                        <TextInput
                          style={styles.brandSearchInput}
                          placeholder="Search brands..."
                          placeholderTextColor="#CCCCCC"
                          value={brandSearch}
                          onChangeText={setBrandSearch}
                          autoFocus
                          autoCorrect={false}
                          autoCapitalize="none"
                        />
                        {brandSearch.length > 0 && (
                          <TouchableOpacity onPress={() => setBrandSearch('')}>
                            <Ionicons name="close-circle" size={20} color="#999999" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Clear selection option */}
                      {form.brandId && (
                        <TouchableOpacity
                          style={styles.brandClearRow}
                          onPress={() => {
                            setForm(prev => ({ ...prev, brandId: null }));
                            Keyboard.dismiss();
                            setBrandModalVisible(false);
                            setBrandSearch('');
                          }}
                        >
                          <Text style={styles.brandClearText}>Clear selection</Text>
                        </TouchableOpacity>
                      )}

                      {/* Other — always pinned at top */}
                      <TouchableOpacity
                        style={[
                          styles.brandRow,
                          form.brandId === brands.find(b => b.slug === 'other')?.id && styles.brandRowSelected
                        ]}
                        onPress={() => {
                          const otherBrand = brands.find(b => b.slug === 'other');
                          if (otherBrand) {
                            setForm(prev => ({ ...prev, brandId: otherBrand.id }));
                          }
                          Keyboard.dismiss();
                          setBrandModalVisible(false);
                          setBrandSearch('');
                        }}
                      >
                        <Text style={styles.brandRowText}>Other</Text>
                        {form.brandId === brands.find(b => b.slug === 'other')?.id && (
                          <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                        )}
                      </TouchableOpacity>

                      <View style={styles.brandDivider} />

                      {/* Brand list */}
                      <FlatList
                        data={filteredBrands.filter(b => b.slug !== 'other')}
                        keyExtractor={(item) => item.id}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            style={[
                              styles.brandRow,
                              form.brandId === item.id && styles.brandRowSelected
                            ]}
                            onPress={() => {
                              setForm(prev => ({ ...prev, brandId: item.id }));
                              Keyboard.dismiss();
                              setBrandModalVisible(false);
                              setBrandSearch('');
                            }}
                          >
                            <Text style={styles.brandRowText}>{item.name}</Text>
                            {form.brandId === item.id && (
                              <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                            )}
                          </TouchableOpacity>
                        )}
                        ItemSeparatorComponent={() => <View style={styles.brandDivider} />}
                      />
                    </SafeAreaView>
                  </Modal>
                </View>
              )}

              {currentStep === 6 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>What's the condition?</Text>
                  <View style={styles.conditionGrid}>
                    {CONDITION_LABELS.map(cond => (
                      <TouchableOpacity
                        key={cond.value}
                        style={[
                          styles.conditionCard,
                          form.condition === cond.value && styles.conditionCardSelected,
                        ]}
                        onPress={() => setForm(prev => ({ ...prev, condition: cond.value }))}
                      >
                        <Text style={[styles.conditionTitle, form.condition === cond.value && styles.conditionTitleSelected]}>
                          {cond.label}
                        </Text>
                        <Text style={styles.conditionDescription}>{cond.description}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {currentStep === 7 && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>Tell us more</Text>
                  <Text style={styles.stepSubtitle}>All optional</Text>
                  {Object.entries(attributesByKey).map(([key, attrs]) => (
                    <View key={key} style={styles.attributeSection}>
                      <Text style={styles.attributeLabel}>{key.toUpperCase().replace('_', ' ')}</Text>
                      <View style={styles.attributeChips}>
                        {attrs.map(attr => (
                          <TouchableOpacity
                            key={attr.attribute_value}
                            style={[
                              styles.attributeChip,
                              form.attributes[key] === attr.attribute_value && styles.attributeChipSelected,
                            ]}
                            onPress={() => handleSelectAttribute(key, attr.attribute_value)}
                          >
                            <Text
                              style={[
                                styles.attributeChipText,
                                form.attributes[key] === attr.attribute_value && styles.attributeChipTextSelected,
                              ]}
                            >
                              {attr.attribute_value}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {currentStep === 8 && form.listingType === 'shop' && (
                <View style={styles.stepContainer}>
                  <Text style={styles.stepTitle}>Pricing & payment</Text>

                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>PRICE</Text>
                    <Text style={styles.requiredStar}> *</Text>
                  </View>
                  <View style={styles.priceInputContainer}>
                    <Text style={styles.priceSymbol}>$</Text>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0.00"
                      placeholderTextColor="#CCCCCC"
                      value={form.price}
                      onChangeText={(text) => setForm(prev => ({ ...prev, price: text }))}
                      keyboardType="decimal-pad"
                      editable={!submitting}
                    />
                  </View>

                  <View style={styles.pricingDivider} />

                  <Text style={styles.inputLabel}>Payment methods (optional)</Text>
                  <Text style={styles.stepSubtitle}>Select all that apply.</Text>
                  {PAYMENT_METHODS.map(method => (
                    <TouchableOpacity
                      key={method}
                      style={styles.checkboxRow}
                      onPress={() => handleTogglePaymentMethod(method)}
                    >
                      <View style={styles.checkbox}>
                        {form.paymentMethods.includes(method) && (
                          <Ionicons name="checkmark" size={20} color="#A4C8D8" />
                        )}
                      </View>
                      <Text style={styles.checkboxText}>{method}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.continueButton, !isContinueEnabled() && styles.continueButtonDisabled]}
                onPress={handleContinue}
                disabled={!isContinueEnabled()}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#E0E0E0',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#A4C8D8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 32,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#999999',
    marginBottom: 24,
  },
  mediaSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requiredStar: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
  },
  requiredNote: {
    fontSize: 12,
    color: '#E53935',
    marginTop: -8,
    marginBottom: 16,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 1,
  },
  videoSectionTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 32,
    marginBottom: 4,
  },
  videoSubtitle: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 8,
  },
  listingTypeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  listingTypeCard: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  listingTypeCardSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#F0F7FA',
  },
  listingTypeText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginTop: 12,
  },
  listingTypeTextSelected: {
    color: '#A4C8D8',
    fontWeight: '600',
  },
  addPhotosContainer: {
    alignItems: 'center',
  },
  addPhotosButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#A4C8D8',
    borderRadius: 12,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotosText: {
    fontSize: 16,
    color: '#999999',
    marginTop: 8,
  },
  addPhotosHint: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 4,
  },
  photoThumbnailContainer: {
    width: 100,
    height: 100,
    marginRight: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  photoScrollContent: {
    paddingVertical: 8,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
  },
  coverBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMorePhotosButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A4C8D8',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    marginRight: 4,
  },
  dragHint: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  dragActiveOverlay: {
    opacity: 0.7,
    borderWidth: 2,
    borderColor: '#A4C8D8',
    borderRadius: 12,
  },
  videoSection: {
    marginTop: 4,
  },
  addVideosButton: {
    height: 220,
    borderWidth: 2,
    borderColor: '#A4C8D8',
    borderRadius: 16,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  videoPreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    width: '100%',
    height: 220,
  },
  videoPreview: {
    width: '100%',
    height: 220,
  },
  removeVideoButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 12,
  },
  categoryRowSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#F0F7FA',
  },
  categoryText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  categoryTextSelected: {
    color: '#A4C8D8',
    fontWeight: '600',
  },
  attributeSection: {
    marginBottom: 24,
  },
  attributeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 1,
    marginBottom: 12,
  },
  attributeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  attributeChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    backgroundColor: '#ffffff',
  },
  attributeChipSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#F0F7FA',
  },
  attributeChipText: {
    fontSize: 14,
    color: '#1A1A1A',
  },
  attributeChipTextSelected: {
    color: '#A4C8D8',
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
    marginBottom: 16,
  },
  textArea: {
    height: 120,
    paddingTop: 16,
    textAlignVertical: 'top',
  },
  brandPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  brandPickerText: {
    fontSize: 16,
    color: '#CCCCCC',
  },
  brandPickerTextSelected: {
    color: '#1A1A1A',
  },
  brandModalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  brandModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  brandModalTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  brandSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    gap: 8,
  },
  brandSearchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  brandClearRow: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F8F8F8',
  },
  brandClearText: {
    fontSize: 14,
    color: '#E53935',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  brandRowSelected: {
    backgroundColor: '#F0F7FA',
  },
  brandRowText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  brandDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 24,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
    gap: 8,
  },
  locationIcon: {
    marginRight: 4,
  },
  locationZipInput: {
    flex: 1,
    fontSize: 16,
    color: '#1A1A1A',
  },
  locationResolvedText: {
    fontSize: 13,
    color: '#34C759',
    marginBottom: 16,
    marginLeft: 4,
  },
  locationErrorText: {
    fontSize: 12,
    color: '#E53935',
    marginBottom: 16,
    marginLeft: 4,
  },
  conditionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  conditionCard: {
    width: '48%',
    padding: 16,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    minHeight: 100,
  },
  conditionCardSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#F0F7FA',
  },
  conditionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  conditionTitleSelected: {
    color: '#A4C8D8',
  },
  conditionDescription: {
    fontSize: 13,
    color: '#999999',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  priceSymbol: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    height: 60,
    fontSize: 24,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  pricingDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 32,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxText: {
    fontSize: 16,
    color: '#1A1A1A',
  },
  reviewContainer: {
    flex: 1,
  },
  reviewCarouselContainer: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  reviewCarouselItem: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
    backgroundColor: '#F0F0F0',
  },
  reviewCarouselImage: {
    width: SCREEN_WIDTH,
    height: CAROUSEL_HEIGHT,
  },
  reviewPaginationContainer: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  reviewPaginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  reviewPaginationDotActive: {
    width: 20,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
  },
  reviewFloatingBack: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
  },
  reviewTitlePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  reviewTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 22,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 12,
  },
  reviewPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#A4C8D8',
    flexShrink: 0,
  },
  reviewFreeBadge: {
    backgroundColor: '#A4C8D8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  reviewFreeText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  reviewCategoryConditionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 0.3,
    marginBottom: 16,
  },
  reviewDivider: {
    height: 8,
    backgroundColor: '#F7F7F7',
    marginHorizontal: -16,
    marginBottom: 16,
  },
  reviewSectionLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    fontWeight: '700',
    color: '#999999',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  reviewSellerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  reviewAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#A4C8D8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarInitials: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  reviewSellerInfo: {
    flex: 1,
  },
  reviewSellerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  reviewSellerMeta: {
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  reviewLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  reviewLocationText: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  reviewDescriptionText: {
    fontSize: 15,
    color: '#444444',
    lineHeight: 22,
    marginBottom: 16,
  },
  reviewDetailsContainer: {
    marginBottom: 20,
  },
  reviewDetailRow: {
    paddingVertical: 4,
  },
  reviewDetailLabel: {
    fontSize: 13,
    color: '#999999',
  },
  reviewDetailValue: {
    fontSize: 15,
    color: '#1A1A1A',
  },
  reviewPaymentMethodsContainer: {
    paddingVertical: 4,
  },
  reviewPaymentPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  reviewPaymentPill: {
    backgroundColor: '#F7F7F7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reviewPaymentPillText: {
    fontSize: 13,
    color: '#1A1A1A',
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginTop: 16,
    textAlign: 'center',
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  continueButton: {
    height: 56,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  continueButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
});
