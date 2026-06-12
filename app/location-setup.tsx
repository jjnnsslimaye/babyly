import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const STORAGE_KEY_LAT = 'babyly_user_lat';
const STORAGE_KEY_LNG = 'babyly_user_lng';
const STORAGE_KEY_LABEL = 'babyly_location_label';
const STORAGE_KEY_RADIUS = 'babyly_radius_meters';
const STORAGE_KEY_SETUP_COMPLETE = 'babyly_location_setup_complete';

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

export default function LocationSetup() {
  const router = useRouter();
  const [locationLoading, setLocationLoading] = useState(false);
  const [zipInput, setZipInput] = useState('');
  const [zipLoading, setZipLoading] = useState(false);
  const [zipError, setZipError] = useState('');
  const [showZip, setShowZip] = useState(false);

  const saveAndContinue = async (lat: number, lng: number, label: string) => {
    await AsyncStorage.multiSet([
      [STORAGE_KEY_LAT, String(lat)],
      [STORAGE_KEY_LNG, String(lng)],
      [STORAGE_KEY_LABEL, label],
      [STORAGE_KEY_RADIUS, '40234'],
      [STORAGE_KEY_SETUP_COMPLETE, 'true'],
    ]);
    router.replace('/(tabs)/shop');
  };

  const handleUseGPS = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setShowZip(true);
        setLocationLoading(false);
        return;
      }
      const coords = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = coords.coords;
      const [place] = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      const rawRegion = place?.region || '';
      const abbreviatedRegion =
        STATE_NAME_TO_ABBR[rawRegion] || rawRegion;
      const label = place
        ? `${place.city || place.district || ''}, ${abbreviatedRegion}`
            .trim()
            .replace(/^,|,$/g, '')
        : 'Current location';
      await saveAndContinue(latitude, longitude, label);
    } catch {
      setShowZip(true);
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
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${zip}&country=US&format=json&limit=1`,
        {
          headers: {
            'User-Agent': 'Babyly/1.0',
          },
        }
      );
      const results = await response.json();
      if (!results || results.length === 0) {
        setZipError('ZIP code not found. Please try another.');
        setZipLoading(false);
        return;
      }
      const { lat, lon, display_name } = results[0];
      const parts = display_name.split(',').map((p: string) => p.trim());
      const city = parts[1] || parts[0] || zip;
      const fullStateName = parts[3] || '';
      const state = STATE_NAME_TO_ABBR[fullStateName] || fullStateName;
      const label = state ? `${city}, ${state}` : city;
      await saveAndContinue(parseFloat(lat), parseFloat(lon), label);
    } catch {
      setZipError('Could not find that ZIP code. Please try again.');
    } finally {
      setZipLoading(false);
      setZipInput('');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Babyly Wordmark */}
          <View style={styles.brandRow}>
            <Ionicons name="location" size={28} color="#A4C8D8" />
            <Text style={styles.brandText}>babyly</Text>
          </View>

          {/* Headline */}
          <Text style={styles.headline}>See what's near you</Text>

          {/* Subheadline */}
          <Text style={styles.subheadline}>
            Babyly finds listings close to you. Share your location to get
            started.
          </Text>

          {/* GPS Button */}
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

          {/* ZIP Section */}
          {showZip && (
            <>
              {/* Divider with "or" */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ZIP Input Row */}
              <View style={styles.zipInputRow}>
                <TextInput
                  style={styles.zipInput}
                  placeholder="ZIP code"
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

              {/* ZIP Error */}
              {zipError ? <Text style={styles.zipError}>{zipError}</Text> : null}
            </>
          )}

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="lock-closed-outline" size={13} color="#999999" />
            <Text style={styles.privacyText}>
              Your location is only used to show nearby listings.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 28,
    color: '#A4C8D8',
  },
  headline: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 26,
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 48,
  },
  subheadline: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 12,
    paddingHorizontal: 32,
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A4C8D8',
    borderRadius: 14,
    height: 54,
    marginTop: 48,
    marginHorizontal: 24,
  },
  gpsButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    fontSize: 13,
    color: '#999999',
    marginHorizontal: 12,
  },
  zipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginHorizontal: 24,
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
    backgroundColor: '#FFFFFF',
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
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#FFFFFF',
  },
  zipError: {
    color: '#E05555',
    fontSize: 13,
    marginTop: 6,
    marginHorizontal: 24,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 32,
    paddingHorizontal: 24,
  },
  privacyText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },
});
