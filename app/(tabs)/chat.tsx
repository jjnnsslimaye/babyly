import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  Animated,
  PanResponder,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import { setUnreadCount } from '../../lib/unreadStore';

type Conversation = {
  id: string;
  listing_id: string;
  listing_type: 'listing' | 'buy_nothing';
  listing_title: string;
  listing_cover_photo_url: string | null;
  listing_price: number | null;
  other_user_id: string;
  other_user_first_name: string;
  other_user_avatar_url: string | null;
  other_user_is_online: boolean;
  last_message_text: string | null;
  last_message_at: string | null;
  last_message_sender_id: string | null;
  unread_count: number;
  is_archived: boolean;
  created_at: string;
};

const SWIPE_THRESHOLD = 20;
const ACTION_WIDTH = 80;

type SwipeableRowProps = {
  children: React.ReactNode;
  onArchive: () => void;
  isArchived: boolean;
};

function SwipeableRow({ children, onArchive, isArchived }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return (
          Math.abs(gestureState.dx) > 20 &&
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 2
        );
      },
      onPanResponderMove: (_, gestureState) => {
        const newX = isOpen.current
          ? Math.min(0, -ACTION_WIDTH + gestureState.dx)
          : Math.min(0, gestureState.dx);
        translateX.setValue(newX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (isOpen.current) {
          if (gestureState.dx > SWIPE_THRESHOLD) {
            isOpen.current = false;
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: -ACTION_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        } else {
          if (gestureState.dx < -SWIPE_THRESHOLD) {
            isOpen.current = true;
            Animated.spring(translateX, {
              toValue: -ACTION_WIDTH,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          } else {
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
              bounciness: 4,
            }).start();
          }
        }
      },
    })
  ).current;

  const close = () => {
    isOpen.current = false;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  };

  return (
    <View style={{ overflow: 'hidden' }}>
      {/* Action button revealed behind the row */}
      <View style={swipeStyles.actionsContainer}>
        <TouchableOpacity
          style={[
            swipeStyles.action,
            { backgroundColor: isArchived ? '#A4C8D8' : '#999999' },
          ]}
          onPress={() => {
            close();
            onArchive();
          }}
        >
          <Ionicons
            name={isArchived ? 'refresh-outline' : 'archive-outline'}
            size={18}
            color="#FFFFFF"
          />
          <Text style={swipeStyles.actionText}>
            {isArchived ? 'Unarchive' : 'Archive'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* The row itself slides left */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  actionsContainer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    flexDirection: 'row',
  },
  action: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
});

const formatRelativeTime = (timestamp: string | null): string => {
  if (!timestamp) return '';
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export default function Chat() {
  const router = useRouter();
  const { session, loadingSession } = useAuth();

  const [activeRole, setActiveRole] = useState<'buying' | 'selling'>('buying');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!loadingSession && !session) {
      router.push('/login');
    }
  }, [loadingSession]);

  const fetchConversations = useCallback(
    async (role: 'buying' | 'selling') => {
      if (!session?.user?.id) return;
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_conversations', {
        p_user_id: session.user.id,
        p_role: role,
      });
      if (error) {
        console.error('Error fetching conversations:', error);
      } else {
        setConversations(data || []);
      }
      setLoading(false);
    },
    [session?.user?.id]
  );

  const fetchTotalUnread = useCallback(async () => {
    if (!session?.user?.id) return;
    const [buyingRes, sellingRes] = await Promise.all([
      supabase.rpc('get_my_conversations', {
        p_user_id: session.user.id,
        p_role: 'buying',
      }),
      supabase.rpc('get_my_conversations', {
        p_user_id: session.user.id,
        p_role: 'selling',
      }),
    ]);
    const buyingUnread = (buyingRes.data || []).reduce(
      (sum: number, c: Conversation) => sum + (c.unread_count || 0), 0
    );
    const sellingUnread = (sellingRes.data || []).reduce(
      (sum: number, c: Conversation) => sum + (c.unread_count || 0), 0
    );
    const total = buyingUnread + sellingUnread;
    setTotalUnread(total);
    setUnreadCount(total);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchConversations(activeRole);
    fetchTotalUnread();
  }, [activeRole, fetchConversations, fetchTotalUnread]);

  useEffect(() => {
    if (!session?.user?.id) return;
    // Note: requires conversations table to be in realtime publication:
    // ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `buyer_id=eq.${session.user.id}`,
        },
        () => {
          fetchConversations(activeRole);
          fetchTotalUnread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `seller_id=eq.${session.user.id}`,
        },
        () => {
          fetchConversations(activeRole);
          fetchTotalUnread();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, activeRole, fetchConversations]);

  useEffect(() => {
    if (!session?.user?.id || conversations.length === 0) return;

    // Get all unique other user IDs from current conversations
    const otherUserIds = [
      ...new Set(conversations.map((c) => c.other_user_id)),
    ];

    if (otherUserIds.length === 0) return;

    const channels = otherUserIds.map((userId) =>
      supabase
        .channel(`chat_presence_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            setConversations((prev) =>
              prev.map((c) =>
                c.other_user_id === userId
                  ? { ...c, other_user_is_online: updated.is_online }
                  : c
              )
            );
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [session?.user?.id, conversations.length]);

  useFocusEffect(
    useCallback(() => {
      if (session?.user?.id) {
        fetchConversations(activeRole);
        fetchTotalUnread();
      }
    }, [session?.user?.id, activeRole, fetchConversations, fetchTotalUnread])
  );

  useEffect(() => {
    if (showArchived && archivedConversations.length === 0) {
      setShowArchived(false);
    }
  }, [archivedConversations, showArchived]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations(activeRole);
    setRefreshing(false);
  };

  const handleRoleChange = (role: 'buying' | 'selling') => {
    if (role === activeRole) return;
    setActiveRole(role);
    setSearchQuery('');
    setShowArchived(false);
  };

  const handleArchive = async (conversationId: string, archive: boolean) => {
    if (!session?.user?.id) return;
    const field =
      activeRole === 'buying' ? 'is_archived_by_buyer' : 'is_archived_by_seller';

    const { error } = await supabase
      .from('conversations')
      .update({ [field]: archive })
      .eq('id', conversationId);

    if (!error) {
      const updated = conversations.map((c) =>
        c.id === conversationId ? { ...c, is_archived: archive } : c
      );
      setConversations(updated);

      // If unarchiving and no archived conversations remain, exit archive view
      if (!archive && showArchived) {
        const remainingArchived = updated.filter((c) => c.is_archived);
        if (remainingArchived.length === 0) {
          setShowArchived(false);
        }
      }
    } else {
      console.error('Error updating archive state:', error);
    }
  };

  const activeConversations = conversations.filter(
    (c) =>
      !c.is_archived &&
      (searchQuery === '' ||
        c.listing_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.other_user_first_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  const archivedConversations = conversations.filter(
    (c) =>
      c.is_archived &&
      (searchQuery === '' ||
        c.listing_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.other_user_first_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase()))
  );

  const archivedUnread = archivedConversations.reduce(
    (sum, c) => sum + (c.unread_count || 0), 0
  );

  const listData = showArchived ? archivedConversations : activeConversations;

  const renderRow = ({ item }: { item: Conversation }) => {
    const initial = (item.other_user_first_name || '?').charAt(0).toUpperCase();
    const timestamp = formatRelativeTime(item.last_message_at);
    const isMine =
      item.last_message_sender_id === session?.user?.id &&
      !!item.last_message_text;
    const previewText = item.last_message_text
      ? isMine
        ? `You: ${item.last_message_text}`
        : item.last_message_text
      : '';
    const hasUnread = item.unread_count > 0;

    return (
      <SwipeableRow
        onArchive={() => handleArchive(item.id, !item.is_archived)}
        isArchived={item.is_archived}
      >
        <TouchableOpacity
          style={styles.row}
          onPress={() =>
            router.push({
              pathname: '/conversation/[id]',
              params: { id: item.id },
            })
          }
          activeOpacity={0.7}
        >
          {/* Avatar with online indicator */}
          <View style={styles.avatarWrap}>
            {item.other_user_avatar_url ? (
              <Image
                source={{ uri: item.other_user_avatar_url }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            {item.other_user_is_online && <View style={styles.onlineDot} />}
          </View>

          {/* Center content */}
          <View style={styles.center}>
            <View style={styles.centerTopRow}>
              <Text style={styles.name} numberOfLines={1}>
                {item.other_user_first_name}
              </Text>
              {timestamp ? (
                <Text style={styles.timestamp}>{timestamp}</Text>
              ) : null}
            </View>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {item.listing_title}
            </Text>
            <Text
              style={[
                styles.preview,
                hasUnread && styles.previewUnread,
              ]}
              numberOfLines={1}
            >
              {previewText}
            </Text>
          </View>

          {/* Right: cover thumbnail + unread badge */}
          <View style={styles.right}>
            {item.listing_cover_photo_url ? (
              <Image
                source={{ uri: item.listing_cover_photo_url }}
                style={styles.coverThumb}
              />
            ) : null}
            {hasUnread ? (
              <View
                style={[
                  styles.unreadBadge,
                  item.listing_cover_photo_url
                    ? styles.unreadBadgeOverlay
                    : styles.unreadBadgeStandalone,
                ]}
              >
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  if (loadingSession) {
    return (
      <View style={styles.loadingFull}>
        <ActivityIndicator size="large" color="#A4C8D8" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header — matches Shop/Free exactly */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="chatbubble-outline" size={31} color="#A4C8D8" />
          <Text style={styles.wordmark}>Messages</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputRow}>
          <Ionicons name="search-outline" size={18} color="#999999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages..."
            placeholderTextColor="#BBBBBB"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#BBBBBB" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Buying / Selling toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[
            styles.togglePill,
            activeRole === 'buying' && styles.togglePillActive,
          ]}
          onPress={() => handleRoleChange('buying')}
        >
          <Text
            style={[
              styles.togglePillText,
              activeRole === 'buying' && styles.togglePillTextActive,
            ]}
          >
            Buying
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.togglePill,
            activeRole === 'selling' && styles.togglePillActive,
          ]}
          onPress={() => handleRoleChange('selling')}
        >
          <Text
            style={[
              styles.togglePillText,
              activeRole === 'selling' && styles.togglePillTextActive,
            ]}
          >
            Selling
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      {loading && conversations.length === 0 ? (
        <View style={styles.tabLoading}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubble-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyStateTitle}>
            {showArchived ? 'No archived messages' : 'No messages yet'}
          </Text>
          <Text style={styles.emptyStateSubtitle}>
            {showArchived
              ? 'Archived conversations will appear here'
              : activeRole === 'buying'
              ? "Tap 'Message Seller' on any listing to start a conversation"
              : 'When buyers reach out, their messages will appear here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#A4C8D8"
              colors={['#A4C8D8']}
            />
          }
        />
      )}

      {/* Archived toggle at bottom */}
      {archivedConversations.length > 0 && (
        <TouchableOpacity
          style={styles.archivedToggle}
          onPress={() => setShowArchived(!showArchived)}
        >
          <Ionicons
            name={showArchived ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#999999"
          />
          <Text style={styles.archivedToggleText}>
            {showArchived
              ? 'Hide archived'
              : `Archived (${archivedConversations.length})`}
          </Text>
          {!showArchived && archivedUnread > 0 && (
            <View style={styles.archivedUnreadBadge}>
              <Text style={styles.archivedUnreadText}>
                {archivedUnread > 9 ? '9+' : archivedUnread}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmark: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 28,
    color: '#A4C8D8',
  },
  // ─── Toggle ───────────────────────────────────────────────
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
  },
  togglePill: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  togglePillActive: {
    backgroundColor: '#A4C8D8',
  },
  togglePillText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#999999',
  },
  togglePillTextActive: {
    color: '#FFFFFF',
  },

  // ─── Search ───────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
  },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1A1A1A',
  },

  // ─── List ─────────────────────────────────────────────────
  listContent: {
    paddingBottom: 32,
  },
  tabLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },

  // ─── Row ──────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  center: {
    flex: 1,
    marginHorizontal: 12,
  },
  centerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    flex: 1,
  },
  timestamp: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#999999',
  },
  listingTitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#A4C8D8',
    marginTop: 2,
  },
  preview: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    marginTop: 2,
  },
  previewUnread: {
    color: '#1A1A1A',
  },

  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    position: 'relative',
  },
  coverThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeStandalone: {
    marginLeft: 4,
  },
  unreadBadgeOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unreadBadgeText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: 14,
  },

  // ─── Empty state ──────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
    flex: 1,
  },
  emptyStateTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
    marginTop: 12,
  },
  emptyStateSubtitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },

  // ─── Archived toggle ──────────────────────────────────────
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
  },
  archivedToggleText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  archivedUnreadBadge: {
    marginLeft: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E05555',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  archivedUnreadText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 10,
    color: '#FFFFFF',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
