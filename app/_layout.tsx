import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import { Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
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
      if (session?.user?.id) {
        registerPushToken(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          setSession(session);
          if (event === 'SIGNED_IN' && session?.user?.id) {
            registerPushToken(session.user.id);
          }
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

  useEffect(() => {
    if (!session?.user?.id) return;

    const setOnlineStatus = async (isOnline: boolean) => {
      await supabase
        .from('users')
        .update({
          is_online: isOnline,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
    };

    // Set online when this effect runs (app is foregrounded)
    setOnlineStatus(true);

    const subscription = AppState.addEventListener(
      'change',
      (nextState: AppStateStatus) => {
        if (nextState === 'active') {
          setOnlineStatus(true);
        } else if (nextState === 'background' || nextState === 'inactive') {
          setOnlineStatus(false);
        }
      }
    );

    return () => {
      // Set offline on cleanup (session change or unmount)
      setOnlineStatus(false);
      subscription.remove();
    };
  }, [session?.user?.id]);

  const registerPushToken = async (userId: string) => {
    try {
      // Push notifications only work on real devices
      if (!Device.isDevice) return;

      // Request permission
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'f9e2cd20-6254-4281-b3a0-c375e3f0341a',
      });

      const token = tokenData.data;

      // Store token in DB
      await supabase
        .from('users')
        .update({ push_token: token })
        .eq('id', userId);

      console.log('Push token registered:', token);

      // Android requires a notification channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#A4C8D8',
        });
      }
    } catch (err) {
      console.error('Error registering push token:', err);
    }
  };

  // Handle notification taps
  const notificationResponseListener = useRef<any>();

  const handleNotificationDeepLink = async (data: any) => {
    if (!data) return;

    console.log('handleNotificationDeepLink data:', JSON.stringify(data));

    // Mark notification as read if we have its ID
    if (data.notification_id) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', data.notification_id)
        .then(() => {
          console.log('Notification marked as read:', data.notification_id);
        });
    }

    // Use the url field set by the Edge Function
    if (data.url) {
      console.log('Deep linking to:', data.url);
      router.push(data.url.replace('babyly:/', ''));
      return;
    }

    // Fallback to type-based routing if no url
    const type = data.type as string;
    switch (type) {
      case 'new_message':
      case 'rating_request':
      case 'rating_confirmed':
        router.push('/(tabs)/chat');
        break;
      case 'listing_favorited':
      case 'listing_status_changed':
        router.push('/(tabs)/shop');
        break;
    }
  };

  useEffect(() => {
    // Set notification handler — how to handle foreground notifications
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Handle notification tap — fires when user taps a notification
    // to open the app
    const subscription =
      Notifications.addNotificationResponseReceivedListener(
        (response) => {
          const data = response.notification.request.content.data;
          console.log('Push notification tap data:', JSON.stringify(data));
          handleNotificationDeepLink(data);
        }
      );

    notificationResponseListener.current = subscription;

    // Handle case where app was opened from closed state via
    // notification tap
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        handleNotificationDeepLink(data);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded || loadingSession) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ session, loadingSession }}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="create-listing" options={{ headerShown: false }} />
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
        <Stack.Screen name="conversation/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="about" options={{ headerShown: false }} />
      </Stack>
    </AuthContext.Provider>
  );
}
