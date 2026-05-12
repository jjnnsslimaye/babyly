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
import {
  GoogleSignin,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';

export default function Login() {
  const router = useRouter();

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

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please enter your email and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const loginEmail = email.trim();

      // Sign in with email and password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Incorrect email or password');
        setPassword('');
        setLoading(false);
        return;
      }

      // Success - navigate back
      router.back();
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An error occurred. Please try again.');
      setPassword('');
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
        router.back();
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

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError('');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (error) setError('');
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
        {/* Wordmark and Tagline */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>Babyly</Text>
          <Text style={styles.tagline}>Your neighborhood baby marketplace</Text>
        </View>

        {/* Input Fields */}
        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor="#CCCCCC"
            value={email}
            onChangeText={handleEmailChange}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Password"
              placeholderTextColor="#CCCCCC"
              value={password}
              onChangeText={handlePasswordChange}
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

          {/* Login Button */}
          {loading ? (
            <View style={styles.loginButton}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          ) : (
            <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
              <Text style={styles.loginButtonText}>Login</Text>
            </TouchableOpacity>
          )}

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/forgot-password')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordContainer}
            onPress={() => router.push('/account-setup')}
            disabled={loading}
          >
            <Text style={styles.forgotPasswordText}>Create an account</Text>
          </TouchableOpacity>

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
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  wordmark: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 36,
    fontWeight: '600',
    color: '#A4C8D8',
    marginBottom: 8,
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
  loginButton: {
    height: 52,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  forgotPasswordContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#A4C8D8',
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
});
