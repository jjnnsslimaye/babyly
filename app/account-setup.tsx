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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

export default function AccountSetup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: Constants.expoConfig?.extra?.googleWebClientId,
      iosClientId: Constants.expoConfig?.extra?.googleIosClientId,
      scopes: ['email', 'profile'],
    });
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreateAccount = async () => {
    // Validation
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Step 1 — Create auth user
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      if (signUpError) {
        if (signUpError.message.toLowerCase().includes('already registered')) {
          setError('An account with this email already exists');
        } else {
          setError('Something went wrong. Please try again.');
        }
        setLoading(false);
        return;
      }

      // Step 2 — Set session so client is authenticated for subsequent calls
      const { session } = data;
      if (!session) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });

      // Step 3 — Navigate to personalize
      router.replace('/personalize');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');

      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;

      if (!idToken) {
        setError('Google Sign-In failed. Please try again.');
        setLoading(false);
        return;
      }

      const { data, error: supabaseError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (supabaseError) {
        console.error('Supabase Google auth error:', supabaseError);
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Check if user has completed profile setup
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('profile_completed')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('Error fetching user profile:', userError);
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      setLoading(false);

      if (!userData.profile_completed) {
        // New user — pass Google name data to Personalize
        const firstName = userInfo.data?.user?.givenName || '';
        const lastName = userInfo.data?.user?.familyName || '';
        router.replace({
          pathname: '/personalize',
          params: { googleFirstName: firstName, googleLastName: lastName },
        });
      } else {
        // Returning user
        router.replace('/(tabs)/shop');
      }

    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        setError('');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        setError('Sign-in already in progress.');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setError('Google Play Services not available.');
      } else {
        console.error('Google Sign-In error:', error);
        setError('Something went wrong. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Back Button */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Welcome to Babyly</Text>
          <Text style={styles.tagline}>
            Everything for your baby... bought, sold, or shared.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#CCCCCC"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (error) setError('');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          {/* Password Input */}
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Min. 8 characters"
              placeholderTextColor="#CCCCCC"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color="#999999"
              />
            </TouchableOpacity>
          </View>

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Create Account Button */}
          {loading ? (
            <View style={styles.createButton}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          ) : (
            <TouchableOpacity style={styles.createButton} onPress={handleCreateAccount}>
              <Text style={styles.createButtonText}>Create Account</Text>
            </TouchableOpacity>
          )}

          {/* Legal Text */}
          <View style={styles.legalContainer}>
            <Text style={styles.legalText}>By signing up, you agree to our </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.legalLink}>Terms</Text>
            </TouchableOpacity>
            <Text style={styles.legalText}> and </Text>
            <TouchableOpacity onPress={() => {}}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Button */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text style={styles.socialButtonText}>Continue with Google</Text>
          </TouchableOpacity>

          {/* Apple Button */}
          <TouchableOpacity
            style={[styles.socialButton, styles.appleButton]}
            onPress={() => {}}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={20} color="#ffffff" />
            <Text style={[styles.socialButtonText, styles.appleButtonText]}>
              Continue with Apple
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  backButton: {
    position: 'absolute',
    left: 24,
    zIndex: 10,
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
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
  passwordContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  passwordInput: {
    height: 52,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 52,
    fontSize: 16,
    color: '#1A1A1A',
  },
  passwordToggle: {
    position: 'absolute',
    right: 16,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginBottom: 16,
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    fontSize: 12,
    color: '#999999',
    marginHorizontal: 12,
  },
  socialButton: {
    height: 52,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  appleButton: {
    backgroundColor: '#1A1A1A',
    borderColor: '#1A1A1A',
  },
  appleButtonText: {
    color: '#ffffff',
  },
  createButton: {
    height: 52,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  createButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  legalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    flexWrap: 'wrap',
  },
  legalText: {
    fontSize: 12,
    color: '#999999',
  },
  legalLink: {
    fontSize: 12,
    color: '#A4C8D8',
  },
});
