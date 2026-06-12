import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { getPendingGoogleProfile, clearPendingGoogleProfile } from '../lib/pendingGoogleProfile';

type AuthContextType = {
  session: Session | null;
  loadingSession: boolean;
};

export const AuthContext = createContext<AuthContextType>({
  session: null,
  loadingSession: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  const router = useRouter();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setSession(session);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loadingSession || !session) return;

    const checkProfileCompleted = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('profile_completed')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking profile_completed:', error);
        return;
      }

      if (data && !data.profile_completed) {
        const { firstName, lastName } = getPendingGoogleProfile();
        clearPendingGoogleProfile();
        router.replace({
          pathname: '/personalize',
          params: {
            googleFirstName: firstName,
            googleLastName: lastName,
          },
        });
      }
    };

    checkProfileCompleted();
  }, [session, loadingSession]);

  if (!fontsLoaded || loadingSession) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ session, loadingSession }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="login"
          options={{
            headerShown: false,
            presentation: 'modal',
          }}
        />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="account-setup" options={{ headerShown: false }} />
        <Stack.Screen name="personalize" options={{ headerShown: false }} />
        <Stack.Screen name="location-setup" options={{ headerShown: false }} />
      </Stack>
    </AuthContext.Provider>
  );
}
