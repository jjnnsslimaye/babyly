import { useState } from 'react';
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

export default function Login() {
  const router = useRouter();

  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!emailOrUsername || !password) {
      setError('Please enter your email/username and password');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let email = emailOrUsername;

      // If input doesn't contain '@', treat as username and resolve to email
      if (!emailOrUsername.includes('@')) {
        const { data, error: rpcError } = await supabase.rpc('get_email_by_username', {
          p_username: emailOrUsername,
        });

        if (rpcError) {
          console.error('RPC error:', rpcError);
          setError('An error occurred. Please try again.');
          setPassword('');
          setLoading(false);
          return;
        }

        if (!data) {
          setError('No account found with that username');
          setPassword('');
          setLoading(false);
          return;
        }

        email = data;
      }

      // Sign in with email and password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('Auth error:', authError);
        setError('Incorrect email/username or password');
        setPassword('');
        setLoading(false);
        return;
      }

      // Success - navigate to shop
      router.replace('/(tabs)/shop');
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An error occurred. Please try again.');
      setPassword('');
      setLoading(false);
    }
  };

  const handleEmailOrUsernameChange = (text: string) => {
    setEmailOrUsername(text);
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
            placeholder="Email or username"
            placeholderTextColor="#CCCCCC"
            value={emailOrUsername}
            onChangeText={handleEmailOrUsernameChange}
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
});
