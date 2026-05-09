import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';

export default function Sell() {
  const router = useRouter();
  const { session, loadingSession } = useAuth();

  useEffect(() => {
    if (!loadingSession && !session) {
      router.push('/login');
    }
  }, [loadingSession]);

  if (loadingSession) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#A4C8D8" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Sell</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});
