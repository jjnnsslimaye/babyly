import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

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

export default function Personalize() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [zipCode, setZipCode] = useState('');
  const [communityAnswer, setCommunityAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [question, setQuestion] = useState<{
    question_key: string;
    prompt_text: string;
  } | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);

  const { googleFirstName, googleLastName } = useLocalSearchParams<{
    googleFirstName?: string;
    googleLastName?: string;
  }>();

  useEffect(() => {
    if (googleFirstName) setFirstName(googleFirstName);
    if (googleLastName) setLastName(googleLastName);
  }, [googleFirstName, googleLastName]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => true
    );
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const { data, error } = await supabase
          .from('profile_questions')
          .select('question_key, prompt_text')
          .eq('is_active', true)
          .order('sort_order');
        if (error || !data || data.length === 0) {
          // Fall back to default if fetch fails
          setQuestion({
            question_key: 'baby_item',
            prompt_text: "What baby item can't you live without?",
          });
          return;
        }
        // Pick a random question from the active list
        const random = data[Math.floor(Math.random() * data.length)];
        setQuestion(random);
      } catch {
        setQuestion({
          question_key: 'baby_item',
          prompt_text: "What baby item can't you live without?",
        });
      } finally {
        setLoadingQuestion(false);
      }
    };
    fetchQuestion();
  }, []);

  const handlePickImage = async () => {
    Alert.alert(
      'Profile Photo',
      'Choose how to add your photo',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
              setError('Camera permission is required to take a photo.');
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled) {
              setAvatarUri(result.assets[0].uri);
              if (error) setError('');
            }
          },
        },
        {
          text: 'Choose from Library',
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
              setError('Permission to access photos is required.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.8,
            });
            if (!result.canceled) {
              setAvatarUri(result.assets[0].uri);
              if (error) setError('');
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleFinishProfile = async () => {
    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name.');
      return;
    }
    if (!zipCode || zipCode.length < 5) {
      setError('Please enter a valid zip code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get current session user id
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        router.replace('/(tabs)/shop');
        return;
      }

      const updates: Record<string, any> = {};

      updates.first_name = firstName.trim();
      updates.last_name = lastName.trim();

      // Avatar upload (only if avatarUri is set)
      if (avatarUri) {
        try {
          const base64 = await FileSystem.readAsStringAsync(avatarUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          const arrayBuffer = decode(base64);
          const filename = `${userId}/${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filename, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.error('Avatar upload error:', uploadError);
          } else {
            const { data: urlData } = supabase.storage
              .from('avatars')
              .getPublicUrl(filename);
            updates.avatar_url = urlData.publicUrl;
          }
        } catch (err) {
          console.error('Error uploading avatar:', err);
        }
      }

      // Zip code geocoding (only if zipCode has 5 digits)
      if (zipCode.length === 5) {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${zipCode}&country=US&format=json&addressdetails=1&limit=1`,
            { headers: { 'User-Agent': 'Babyly/1.0' } }
          );
          const results = await response.json();

          if (results.length > 0) {
            const { lat, lon, display_name } = results[0];

            // Parse city and state from address details
            const address = results[0].address;
            const city = address.city || address.town || address.village || address.county || '';
            const state = address.state || '';
            const stateAbbr = US_STATE_ABBREVIATIONS[state] || state;
            const locationLabel = city && stateAbbr ? `${city}, ${stateAbbr}` : city || stateAbbr || display_name;

            updates.location = `SRID=4326;POINT(${lon} ${lat})`;
            updates.location_label = locationLabel;
          } else {
            setError('Zip code not found. Please try again.');
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Error geocoding zip code:', err);
        }
      }

      // Community answer (only if communityAnswer is not empty)
      if (communityAnswer.trim() && question) {
        updates.bio = { [question.question_key]: communityAnswer.trim() };
      }

      // Set profile as completed
      updates.profile_completed = true;

      // If updates object is not empty, update the users table
      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId);

        if (updateError) {
          console.error('Error updating profile:', updateError);
          setError('Something went wrong. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Navigate to Shop
      router.replace('/(tabs)/shop');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerButton} />
        <Text style={styles.headerTitle}>Personalize</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title and Tagline */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Tell us about you</Text>
          <Text style={styles.tagline}>Let the community know who you are.</Text>
        </View>

        {/* Avatar Upload Section */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
          <View style={styles.avatarCircle}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-outline" size={48} color="#A4C8D8" />
            )}
          </View>
          <View style={styles.cameraBadge}>
            <Ionicons name="camera-outline" size={20} color="#ffffff" />
          </View>
        </TouchableOpacity>

        {/* First Name + Last Name Row */}
        <View style={styles.nameRow}>
          <View style={styles.halfSection}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>FIRST NAME</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="First name"
              placeholderTextColor="#CCCCCC"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                if (error) setError('');
              }}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
          <View style={styles.halfSection}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>LAST NAME</Text>
              <Text style={styles.required}> *</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Last name"
              placeholderTextColor="#CCCCCC"
              value={lastName}
              onChangeText={(text) => {
                setLastName(text);
                if (error) setError('');
              }}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        </View>

        {/* Zip Code Input */}
        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>ZIP CODE</Text>
            <Text style={styles.required}> *</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="e.g. 75070"
            placeholderTextColor="#CCCCCC"
            value={zipCode}
            onChangeText={(text) => {
              setZipCode(text);
              if (error) setError('');
            }}
            keyboardType="numeric"
            maxLength={5}
            editable={!loading}
          />
        </View>

        {/* Community Question Card */}
        <View style={styles.communityCard}>
          <View style={styles.communityHeader}>
            <Ionicons name="chatbubble-outline" size={16} color="#A4C8D8" />
            <Text style={styles.communityHeaderText}>COMMUNITY QUESTION</Text>
          </View>
          {loadingQuestion ? (
            <ActivityIndicator
              size="small"
              color="#A4C8D8"
              style={{ marginVertical: 12 }}
            />
          ) : (
            <>
              <Text style={styles.questionText}>
                {question?.prompt_text ?? "What baby item can't you live without?"}
              </Text>
              <TextInput
                style={styles.communityInput}
                placeholder="Share your answer..."
                placeholderTextColor="#CCCCCC"
                value={communityAnswer}
                onChangeText={(text) => {
                  setCommunityAnswer(text);
                  if (error) setError('');
                }}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                editable={!loading}
              />
            </>
          )}
        </View>

        {/* Error Message */}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {/* Finish Profile Button */}
        {loading ? (
          <View style={styles.finishButton}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        ) : (
          <TouchableOpacity style={styles.finishButton} onPress={handleFinishProfile}>
            <Text style={styles.finishButtonText}>Finish Profile</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E0E0E0',
  },
  headerButton: {
    width: 60,
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  titleContainer: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  halfSection: {
    width: '48%',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: '#A4C8D8',
    borderStyle: 'solid',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: '50%',
    marginRight: -72,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginBottom: 24,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    letterSpacing: 1,
  },
  required: {
    fontSize: 12,
    fontWeight: '600',
    color: '#E53935',
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A1A1A',
  },
  communityCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  communityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  communityHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#A4C8D8',
    letterSpacing: 1,
    marginLeft: 6,
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    marginTop: 12,
    marginBottom: 12,
  },
  communityInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 72,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginBottom: 16,
    textAlign: 'center',
  },
  finishButton: {
    height: 52,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
