import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    const checkLocationSetup = async () => {
      const val = await AsyncStorage.getItem(
        'babyly_location_setup_complete'
      );
      if (val === 'true') {
        router.replace('/(tabs)/shop');
      } else {
        router.replace('/location-setup');
      }
    };
    checkLocationSetup();
  }, []);

  return null;
}
