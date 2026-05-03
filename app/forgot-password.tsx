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

export default function ForgotPassword() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSendResetLink = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    if (!email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);

      if (resetError) {
        console.error('Reset error:', resetError);
        setError('Something went wrong. Please try again.');
        setLoading(false);
        return;
      }

      // Success - show confirmation view
      setSubmitted(true);
      setLoading(false);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (error) setError('');
  };

  if (submitted) {
    // STATE 2: Confirmation view
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

          {/* Confirmation Content */}
          <View style={styles.confirmationContent}>
            <Ionicons name="checkmark-circle-outline" size={64} color="#A4C8D8" />
            <Text style={styles.confirmationTitle}>Check your email</Text>
            <Text style={styles.confirmationSubtitle}>
              We sent a reset link to {email}. Check your inbox and follow the link to reset
              your password.
            </Text>
          </View>

          {/* Back to Login Link */}
          <TouchableOpacity
            style={styles.backToLoginContainer}
            onPress={() => router.push('/login')}
          >
            <Text style={styles.backToLoginText}>Back to login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // STATE 1: Email input view
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

        {/* Instruction Text */}
        <Text style={styles.instructionText}>
          Enter your email and we'll send you a reset link.
        </Text>

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
            keyboardType="email-address"
            editable={!loading}
          />

          {/* Error Message */}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Send Reset Link Button */}
          {loading ? (
            <View style={styles.sendButton}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          ) : (
            <TouchableOpacity style={styles.sendButton} onPress={handleSendResetLink}>
              <Text style={styles.sendButtonText}>Send reset link</Text>
            </TouchableOpacity>
          )}

          {/* Back to Login Link */}
          <TouchableOpacity
            style={styles.backToLoginContainer}
            onPress={() => router.push('/login')}
            disabled={loading}
          >
            <Text style={styles.backToLoginText}>Back to login</Text>
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
  instructionText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
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
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#E53935',
    marginBottom: 16,
    marginTop: 8,
  },
  sendButton: {
    height: 52,
    backgroundColor: '#A4C8D8',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  sendButtonText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  backToLoginContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  backToLoginText: {
    fontSize: 14,
    color: '#A4C8D8',
  },
  confirmationContent: {
    alignItems: 'center',
    marginBottom: 32,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  confirmationSubtitle: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
