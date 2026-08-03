import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import BuyerRatingModal from './BuyerRatingModal';

type NotificationBellProps = {
  userId: string;
};

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  data: {
    conversation_id?: string;
    listing_id?: string;
    listing_type?: string;
    seller_id?: string;
    buyer_id?: string;
    new_status?: string;
  };
  is_read: boolean;
  created_at: string;
};

const getNotifIcon = (type: string): any => {
  switch (type) {
    case 'rating_request':
      return 'star-outline';
    case 'rating_confirmed':
      return 'checkmark-circle-outline';
    case 'listing_favorited':
      return 'heart-outline';
    case 'listing_status_changed':
      return 'pricetag-outline';
    default:
      return 'notifications-outline';
  }
};

const formatRelativeTime = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

export default function NotificationBell({ userId }: NotificationBellProps) {
  const router = useRouter();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [buyerRatingVisible, setBuyerRatingVisible] = useState(false);
  const [pendingRatingData, setPendingRatingData] = useState<{
    listingId: string;
    listingType: 'listing' | 'buy_nothing';
    sellerId: string;
    sellerName: string;
  } | null>(null);

  const fetchNotifications = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_notifications', {
      p_user_id: userId,
    });
    if (!error && data) {
      // Filter out new_message type — messages handled separately in Chat tab
      const filtered = (data as AppNotification[]).filter(
        (n) => n.type !== 'new_message'
      );
      setNotifications(filtered);
      setUnreadCount(filtered.filter((n) => !n.is_read).length);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notifications_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchNotifications()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === updated.id
                ? { ...n, is_read: updated.is_read }
                : n
            )
          );
          setUnreadCount((prev) =>
            updated.is_read ? Math.max(0, prev - 1) : prev
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleOpenModal = () => {
    setModalVisible(true);
  };

  const handleMarkAllRead = async () => {
    // Mark all as read individually in DB
    const unreadIds = notifications
      .filter((n) => !n.is_read)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const markNotificationRead = async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleNotificationTap = async (notification: AppNotification) => {
    if (!notification.is_read) {
      await markNotificationRead(notification.id);
    }
    setModalVisible(false);

    const { data } = notification;

    switch (notification.type) {
      case 'rating_request':
        if (data.conversation_id) {
          router.push({
            pathname: '/conversation/[id]',
            params: { id: data.conversation_id },
          });
        } else if (data.listing_id && data.seller_id) {
          setPendingRatingData({
            listingId: data.listing_id,
            listingType: (data.listing_type || 'listing') as
              | 'listing'
              | 'buy_nothing',
            sellerId: data.seller_id,
            sellerName: '',
          });
          setTimeout(() => setBuyerRatingVisible(true), 300);
        }
        break;

      case 'rating_confirmed':
        if (data.buyer_id) {
          router.push(`/profile/${data.buyer_id}`);
        }
        break;

      case 'listing_favorited':
      case 'listing_status_changed':
        if (data.listing_id) {
          router.push(
            `/listing/${data.listing_id}${
              data.listing_type === 'buy_nothing' ? '?type=buy_nothing' : ''
            }`
          );
        }
        break;
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleOpenModal}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ position: 'relative' }}
      >
        <Ionicons
          name="notifications-outline"
          size={24}
          color="#1A1A1A"
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView
          style={{ flex: 1, backgroundColor: '#FAFAFA' }}
          edges={['top']}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Notifications</Text>
            {unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={styles.markAllRead}>Mark all read</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
          </View>

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="large" color="#A4C8D8" />
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="notifications-outline"
                size={48}
                color="#CCCCCC"
              />
              <Text style={styles.emptyStateText}>No notifications yet</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {notifications.map((notification) => (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notifRow,
                    !notification.is_read && styles.notifRowUnread,
                  ]}
                  onPress={() => handleNotificationTap(notification)}
                  activeOpacity={0.7}
                >
                  {/* Type icon */}
                  <View style={styles.notifIconWrap}>
                    <Ionicons
                      name={getNotifIcon(notification.type)}
                      size={20}
                      color="#A4C8D8"
                    />
                  </View>

                  {/* Content */}
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{notification.title}</Text>
                    <Text style={styles.notifBody} numberOfLines={2}>
                      {notification.body}
                    </Text>
                    <Text style={styles.notifTime}>
                      {formatRelativeTime(notification.created_at)}
                    </Text>
                  </View>

                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      {pendingRatingData && (
        <BuyerRatingModal
          visible={buyerRatingVisible}
          onClose={() => {
            setBuyerRatingVisible(false);
            setPendingRatingData(null);
          }}
          listingId={pendingRatingData.listingId}
          listingType={pendingRatingData.listingType}
          sellerId={pendingRatingData.sellerId}
          sellerName={pendingRatingData.sellerName}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
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
  badgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontFamily: 'Quicksand_700Bold',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  markAllRead: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#A4C8D8',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 60,
  },
  emptyStateText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#999999',
    marginTop: 12,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  notifRowUnread: {
    backgroundColor: '#EBF5F9',
    borderLeftWidth: 3,
    borderLeftColor: '#A4C8D8',
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 2,
  },
  notifBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#CCCCCC',
  },
});
