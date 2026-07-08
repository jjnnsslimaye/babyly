import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, StyleSheet, Text, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../_layout';
import { useState, useEffect } from 'react';
import { subscribeToUnread, getUnreadCount } from '../../lib/unreadStore';

function CustomTabBar(props: any) {
  const { state, descriptors, navigation } = props;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const [unread, setUnread] = useState(getUnreadCount());

  useEffect(() => {
    const unsub = subscribeToUnread(setUnread);
    return unsub;
  }, []);

  const PROTECTED_TABS = ['sell', 'chat', 'profile'];

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const label = options.title || route.name;

        // Custom elevated button for Sell tab
        if (route.name === 'sell') {
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (!session) {
                  router.push('/login');
                  return;
                }
                router.push('/sell');
              }}
              style={styles.sellButtonContainer}
            >
              {({ pressed }) => (
                <View style={[styles.sellButton, { opacity: pressed ? 0.7 : 1.0 }]}>
                  <Ionicons name="add" size={32} color="#ffffff" />
                </View>
              )}
            </Pressable>
          );
        }

        // Standard tabs
        const onPress = () => {
          if (PROTECTED_TABS.includes(route.name) && !session) {
            router.push('/login');
            return;
          }

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.tab}
          >
            <View style={{ position: 'relative' }}>
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? '#A4C8D8' : '#999999',
                size: 24,
              })}
              {route.name === 'chat' && unread > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>
                    {unread > 99 ? '99+' : unread}
                  </Text>
                </View>
              )}
            </View>
            {typeof label === 'string' && (
              <Text
                style={[
                  styles.label,
                  { color: isFocused ? '#A4C8D8' : '#999999' },
                ]}
              >
                {label}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#A4C8D8',
        tabBarInactiveTintColor: '#999999',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          height: 60,
          borderTopWidth: 0.5,
          borderTopColor: '#E5E5E5',
        },
        tabBarIndicatorStyle: {
          height: 0,
        },
        headerShown: false,
      }}
      initialRouteName="shop"
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="shop"
        options={{
          title: 'Shop',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bag-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="free"
        options={{
          title: 'Free',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="gift-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="sell"
        options={{
          title: '',
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 0.5,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  label: {
    fontSize: 12,
    marginTop: 4,
  },
  sellButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  sellButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E05555',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  tabBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Quicksand_700Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
});
