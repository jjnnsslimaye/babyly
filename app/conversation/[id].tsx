import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../_layout';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_first_name: string;
  sender_avatar_url: string | null;
  content: string | null;
  image_url: string | null;
  is_read: boolean;
  created_at: string;
};

type ConversationDetail = {
  id: string;
  listing_id: string;
  listing_type: 'listing' | 'buy_nothing';
  listing_title: string;
  listing_cover_photo_url: string | null;
  listing_price: number | null;
  listing_status: string;
  other_user_id: string;
  other_user_first_name: string;
  other_user_avatar_url: string | null;
  other_user_is_online: boolean;
  other_user_last_seen_at: string | null;
  buyer_id: string;
  seller_id: string;
};

function formatLastSeen(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'Offline';
  const now = new Date();
  const date = new Date(lastSeenAt);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Last seen just now';
  if (diffMins < 60) return `Last seen ${diffMins}m ago`;
  if (diffHours < 24) return `Last seen ${diffHours}h ago`;
  if (diffDays === 1) return 'Last seen yesterday';
  return `Last seen ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`;
}

function formatMessageTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function MessageStatus({ isRead }: { isRead: boolean }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1, marginTop: 2, alignSelf: 'flex-end' }}>
      <Ionicons
        name="checkmark"
        size={12}
        color={isRead ? '#A4C8D8' : '#CCCCCC'}
      />
      <Ionicons
        name="checkmark"
        size={12}
        color={isRead ? '#A4C8D8' : '#CCCCCC'}
        style={{ marginLeft: -6 }}
      />
    </View>
  );
}

export default function Conversation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id: string;
    listing_id?: string;
    listing_type?: string;
    seller_id?: string;
    listing_title?: string;
    listing_cover_photo_url?: string;
    listing_price?: string;
    listing_status?: string;
  }>();

  const isNewParam = params.id === 'new';
  const [conversationId, setConversationId] = useState<string | null>(
    isNewParam ? null : params.id
  );
  const isNew = conversationId === null;
  const { session } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<ConversationDetail | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pendingImageUri, setPendingImageUri] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const fetchConversationDetail = async () => {
    if (!session?.user?.id) return;
      console.log('fetchConversationDetail - session exists:', !!session?.user?.id, 'isNew:', isNew);

    if (isNewParam && !conversationId) {
      // No existing conversation — build from params
      const sellerRes = await supabase
        .from('users')
        .select('id, first_name, avatar_url, is_online, last_seen_at')
        .eq('id', params.seller_id!)
        .single();

      setConversation({
        id: 'new',
        listing_id: params.listing_id!,
        listing_type: params.listing_type as 'listing' | 'buy_nothing',
        listing_title: params.listing_title || '',
        listing_cover_photo_url: params.listing_cover_photo_url || null,
        listing_price: params.listing_price
          ? parseFloat(params.listing_price)
          : null,
        listing_status: params.listing_status || 'available',
        other_user_id: params.seller_id!,
        other_user_first_name: sellerRes.data?.first_name || '',
        other_user_avatar_url: sellerRes.data?.avatar_url || null,
        other_user_is_online: sellerRes.data?.is_online || false,
        other_user_last_seen_at: sellerRes.data?.last_seen_at || null,
        buyer_id: session.user.id,
        seller_id: params.seller_id!,
      });
      return;
    }

    // Existing conversation — fetch from DB
    const { data, error } = await supabase
      .from('conversations')
      .select(`id, listing_id, listing_type, buyer_id, seller_id`)
      .eq('id', conversationId!)
      .single();

    if (error || !data) {
      console.error('Error fetching conversation:', error);
      return;
    }

    const otherUserId =
      data.buyer_id === session.user.id ? data.seller_id : data.buyer_id;

    const [userRes, listingRes] = await Promise.all([
      supabase
        .from('users')
        .select('id, first_name, avatar_url, is_online, last_seen_at')
        .eq('id', otherUserId)
        .single(),
      data.listing_type === 'listing'
        ? supabase
            .from('listings')
            .select('title, cover_photo_url, price, status')
            .eq('id', data.listing_id)
            .single()
        : supabase
            .from('buy_nothing_listings')
            .select('title, cover_photo_url, status')
            .eq('id', data.listing_id)
            .single(),
    ]);

    setConversation({
      id: data.id,
      listing_id: data.listing_id,
      listing_type: data.listing_type,
      listing_title: listingRes.data?.title || '',
      listing_cover_photo_url: listingRes.data?.cover_photo_url || null,
      listing_price:
        listingRes.data && 'price' in listingRes.data
          ? (listingRes.data as any).price
          : null,
      listing_status: listingRes.data?.status || 'available',
      other_user_id: otherUserId,
      other_user_first_name: userRes.data?.first_name || '',
      other_user_avatar_url: userRes.data?.avatar_url || null,
      other_user_is_online: userRes.data?.is_online || false,
      other_user_last_seen_at: userRes.data?.last_seen_at || null,
      buyer_id: data.buyer_id,
      seller_id: data.seller_id,
    });
  };

  const fetchMessages = async () => {
    if (!session?.user?.id || !conversationId) return;
    const { data, error } = await supabase.rpc('get_conversation_messages', {
      p_conversation_id: conversationId,
      p_user_id: session.user.id,
    });
    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      setMessages(data || []);
    }
    setLoading(false);
  };

  // Mount
  useEffect(() => {
    const init = async () => {
      await fetchConversationDetail();
      await fetchMessages();
      setLoading(false);
    };
    init();
  }, [conversationId, session?.user?.id]);

  // Realtime subscription — new messages
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages_${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const { data: senderData } = await supabase
            .from('users')
            .select('first_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .single();

          const message: Message = {
            id: newMsg.id,
            conversation_id: newMsg.conversation_id,
            sender_id: newMsg.sender_id,
            sender_first_name: senderData?.first_name || '',
            sender_avatar_url: senderData?.avatar_url || null,
            content: newMsg.content,
            image_url: newMsg.image_url,
            is_read: newMsg.is_read,
            created_at: newMsg.created_at,
          };

          setMessages((prev) => {
            if (prev.find((m) => m.id === newMsg.id)) return prev;
            return [...prev, message];
          });

          if (newMsg.sender_id !== session?.user?.id) {
            await supabase.rpc('get_conversation_messages', {
              p_conversation_id: conversationId,
              p_user_id: session?.user?.id,
            });
          }
        }
      )
      // Note: requires messages table to be in realtime publication:
      // ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
      // (already done — messages table is already in publication)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...m, is_read: updated.is_read } : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, session?.user?.id]);

  useEffect(() => {
    if (!conversation?.other_user_id) return;

    const channel = supabase
      .channel(`presence_${conversation.other_user_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${conversation.other_user_id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setConversation((prev) =>
            prev
              ? {
                  ...prev,
                  other_user_is_online: updated.is_online,
                  other_user_last_seen_at: updated.last_seen_at,
                }
              : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation?.other_user_id]);

  const handleSend = async () => {
    const text = inputText.trim();
    const hasText = text.length > 0;
    const hasImage = !!pendingImageUri;

    if ((!hasText && !hasImage) || !session?.user?.id || sending) return;
    if (text.length > 2000) return;

    setSending(true);
    setInputText('');
    setPendingImageUri(null);

    try {
      let uploadedImageUrl: string | null = null;
      let activeConversationId = conversationId;

      if (hasImage) {
        setUploadingImage(true);
        const base64 = await FileSystem.readAsStringAsync(pendingImageUri!, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const arrayBuffer = decode(base64);
        const timestamp = Date.now();
        const filePath = `messages/${activeConversationId || 'pending'}/${session.user.id}/${timestamp}.jpg`;

        const { error: uploadError } = await supabase.storage
          .from('message-images')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('message-images')
          .getPublicUrl(filePath);

        uploadedImageUrl = publicUrl;
        setUploadingImage(false);
      }

      // Create conversation if this is the first message
      if (!activeConversationId) {
        const { data: convData, error: convError } = await supabase.rpc(
          'get_or_create_conversation',
          {
            p_listing_id: params.listing_id!,
            p_listing_type: params.listing_type!,
            p_buyer_id: session.user.id,
            p_seller_id: params.seller_id!,
          }
        );
        if (convError || !convData) {
          console.error('Error creating conversation:', convError);
          Alert.alert('Error', 'Could not send message. Please try again.');
          setSending(false);
          return;
        }
        activeConversationId = convData;
        setConversationId(convData);
      }

      const { data, error } = await supabase.rpc('send_message', {
        p_conversation_id: activeConversationId,
        p_sender_id: session.user.id,
        p_content: hasText ? text : null,
        p_image_url: uploadedImageUrl,
      });

      if (error) {
        console.error('Error sending message:', error);
        setInputText(text);
        if (uploadedImageUrl) setPendingImageUri(pendingImageUri);
      } else if (data && data.length > 0) {
        const sent = data[0];
        const newMessage: Message = {
          id: sent.id,
          conversation_id: sent.conversation_id,
          sender_id: sent.sender_id,
          sender_first_name: session.user.user_metadata?.first_name || '',
          sender_avatar_url: null,
          content: sent.content,
          image_url: sent.image_url,
          is_read: sent.is_read,
          created_at: sent.created_at,
        };
        setMessages((prev) => {
          if (prev.find((m) => m.id === sent.id)) return prev;
          return [...prev, newMessage];
        });
      }
    } catch (err) {
      console.error('Error sending:', err);
      Alert.alert('Error', 'Could not send message. Please try again.');
      setUploadingImage(false);
    } finally {
      setSending(false);
      setUploadingImage(false);
    }
  };

  const handleSendImage = async () => {
    if (uploadingImage) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.5,
      exif: false,
    });

    if (result.canceled) return;
    setPendingImageUri(result.assets[0].uri);
  };

  const shouldShowDateSeparator = (index: number): boolean => {
    // In inverted list, data is reversed — index 0 is newest
    // Compare with next item (which is older in reversed array)
    const reversed = [...messages].reverse();
    if (index === reversed.length - 1) return true;
    const current = new Date(reversed[index].created_at);
    const next = new Date(reversed[index + 1].created_at);
    return current.toDateString() !== next.toDateString();
  };

  const formatDateSeparator = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === now.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Find last message sent by me for the Read receipt
  let lastMyMessageIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sender_id === session?.user?.id) {
      lastMyMessageIndex = i;
      break;
    }
  }

  const canSend =
    (inputText.trim().length > 0 || !!pendingImageUri) && !sending;

  const openListing = () => {
    if (!conversation) return;
    if (conversation.listing_type === 'buy_nothing') {
      router.push(`/listing/${conversation.listing_id}?type=buy_nothing`);
    } else {
      router.push(`/listing/${conversation.listing_id}`);
    }
  };

  const renderListingBadge = () => {
    if (!conversation) return null;
    const status = conversation.listing_status;
    if (status === 'pending') {
      return (
        <View style={[styles.statusPill, styles.pendingPill]}>
          <Text style={styles.pendingPillText}>Pending</Text>
        </View>
      );
    }
    if (status === 'sold') {
      return (
        <View style={[styles.statusPill, styles.soldPill]}>
          <Text style={styles.soldPillText}>Sold</Text>
        </View>
      );
    }
    if (status === 'claimed') {
      return (
        <View style={[styles.statusPill, styles.soldPill]}>
          <Text style={styles.soldPillText}>Claimed</Text>
        </View>
      );
    }
    return null;
  };

  const renderMessage = ({
    item,
    index,
  }: {
    item: Message;
    index: number;
  }) => {
    const isMine = item.sender_id === session?.user?.id;
    const isImageOnly = !!item.image_url && !item.content;

    return (
      <View>
        {shouldShowDateSeparator(index) && (
          <View style={styles.dateSeparator}>
            <View style={styles.dateSeparatorLine} />
            <Text style={styles.dateSeparatorText}>
              {formatDateSeparator(item.created_at)}
            </Text>
            <View style={styles.dateSeparatorLine} />
          </View>
        )}

        <View
          style={[
            styles.bubbleWrap,
            isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs,
          ]}
        >
          {isImageOnly ? (
            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
                { padding: 4 },
              ]}
            >
              <Image
                source={{ uri: item.image_url! }}
                style={styles.imageMessage}
                resizeMode="cover"
              />
            </View>
          ) : (
            <View
              style={[
                styles.bubble,
                isMine ? styles.bubbleMine : styles.bubbleTheirs,
              ]}
            >
              {item.image_url ? (
                <Image
                  source={{ uri: item.image_url }}
                  style={[styles.imageMessage, { marginBottom: 6 }]}
                  resizeMode="cover"
                />
              ) : null}
              {item.content ? (
                <Text
                  style={[
                    styles.bubbleText,
                    isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs,
                  ]}
                >
                  {item.content}
                </Text>
              ) : null}
            </View>
          )}

          {isMine && index === [...messages].reverse().map((m, i) => m.sender_id === session?.user?.id ? i : -1).filter(i => i !== -1)[0] && (
            <MessageStatus isRead={item.is_read} />
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.loadingFull}>
          <ActivityIndicator size="large" color="#A4C8D8" />
        </View>
      </SafeAreaView>
    );
  }

  if (!conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color="#CCCCCC" />
          <Text style={styles.emptyTitle}>Conversation not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherInitial = (conversation.other_user_first_name || '?')
    .charAt(0)
    .toUpperCase();

  return (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'android' ? -(insets.bottom + 8) : 0}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerName} numberOfLines={1}>
              {conversation.other_user_first_name}
            </Text>
            <Text style={[
              styles.headerStatus,
              { color: conversation.other_user_is_online ? '#34C759' : '#999999' }
            ]}>
              {conversation.other_user_is_online
                ? 'Online'
                : formatLastSeen(conversation.other_user_last_seen_at)}
            </Text>
          </View>

          <View style={styles.headerAvatarWrap}>
            {conversation.other_user_avatar_url ? (
              <Image
                source={{ uri: conversation.other_user_avatar_url }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarPlaceholder]}>
                <Text style={styles.headerAvatarInitial}>{otherInitial}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Listing Context Card */}
        <TouchableOpacity
          style={styles.listingCard}
          onPress={openListing}
          activeOpacity={0.7}
        >
          <View style={styles.listingThumb}>
            {conversation.listing_cover_photo_url ? (
              <Image
                source={{ uri: conversation.listing_cover_photo_url }}
                style={styles.listingThumbImage}
              />
            ) : (
              <View style={styles.listingThumbPlaceholder}>
                <Ionicons name="image-outline" size={20} color="#CCCCCC" />
              </View>
            )}
          </View>
          <View style={styles.listingInfo}>
            <Text style={styles.listingTitle} numberOfLines={1}>
              {conversation.listing_title}
            </Text>
            <View style={styles.listingMetaRow}>
              {conversation.listing_type === 'listing' &&
              conversation.listing_price !== null ? (
                <Text style={styles.listingPrice}>
                  ${conversation.listing_price.toFixed(2)}
                </Text>
              ) : (
                <Text style={styles.listingPriceFree}>Free</Text>
              )}
              {renderListingBadge()}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={14} color="#CCCCCC" />
        </TouchableOpacity>

        {/* Messages */}
        {messages.length === 0 ? (
          <View style={styles.emptyChat}>
            <Ionicons
              name="chatbubble-outline"
              size={48}
              color="#CCCCCC"
            />
            <Text style={styles.emptyChatSubtitle}>
              Send the first message to start the conversation
            </Text>

            {/* Quick reply suggestions */}
            <View style={styles.quickReplies}>
              {[
                'Is this still available?',
                'Can I pick this up today?',
                'Is the price negotiable?',
              ].map((suggestion) => (
                <TouchableOpacity
                  key={suggestion}
                  style={styles.quickReplyPill}
                  onPress={async () => {
                    if (sending) return;
                    setSending(true);
                    try {
                      let activeConversationId = conversationId;
                      if (!activeConversationId) {
                        const { data: convData, error: convError } = await supabase.rpc(
                          'get_or_create_conversation',
                          {
                            p_listing_id: params.listing_id!,
                            p_listing_type: params.listing_type!,
                            p_buyer_id: session!.user.id,
                            p_seller_id: params.seller_id!,
                          }
                        );
                        if (convError || !convData) {
                          console.error('Error creating conversation:', convError);
                          setSending(false);
                          return;
                        }
                        activeConversationId = convData;
                        setConversationId(convData);
                      }
                      const { data, error } = await supabase.rpc('send_message', {
                        p_conversation_id: activeConversationId,
                        p_sender_id: session!.user.id,
                        p_content: suggestion,
                        p_image_url: null,
                      });
                      if (!error && data && data.length > 0) {
                        const sent = data[0];
                        const newMessage: Message = {
                          id: sent.id,
                          conversation_id: sent.conversation_id,
                          sender_id: sent.sender_id,
                          sender_first_name: session!.user.user_metadata?.first_name || '',
                          sender_avatar_url: null,
                          content: sent.content,
                          image_url: sent.image_url,
                          is_read: sent.is_read,
                          created_at: sent.created_at,
                        };
                        setMessages((prev) => {
                          if (prev.find((m) => m.id === sent.id)) return prev;
                          return [...prev, newMessage];
                        });
                      }
                    } catch (err) {
                      console.error('Error sending quick reply:', err);
                    } finally {
                      setSending(false);
                    }
                  }}
                >
                  <Text style={styles.quickReplyText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={[...messages].reverse()}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            inverted
          />
        )}

        {/* Pending image preview */}
        {pendingImageUri && (
          <View style={styles.pendingImageContainer}>
            <Image
              source={{ uri: pendingImageUri }}
              style={styles.pendingImagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              style={styles.pendingImageRemove}
              onPress={() => setPendingImageUri(null)}
            >
              <Ionicons name="close-circle" size={22} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Input bar */}
        <View style={[
          styles.inputBar,
          { paddingBottom: insets.bottom + 8 }
        ]}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={handleSendImage}
            disabled={uploadingImage}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            {uploadingImage ? (
              <ActivityIndicator size="small" color="#A4C8D8" />
            ) : (
              <Ionicons name="image-outline" size={24} color="#A4C8D8" />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor="#BBBBBB"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              !canSend && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!canSend}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  loadingFull: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 8,
  },
  backButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
  },
  headerName: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  headerStatus: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    marginTop: 1,
  },
  headerAvatarWrap: {
    width: 36,
    height: 36,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  headerAvatarPlaceholder: {
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },

  // ─── Listing Card ─────────────────────────────────────────
  listingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  listingThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  listingThumbImage: {
    width: '100%',
    height: '100%',
  },
  listingThumbPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listingInfo: {
    flex: 1,
  },
  listingTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 13,
    color: '#1A1A1A',
  },
  listingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  listingPrice: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#1A1A1A',
  },
  listingPriceFree: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#A4C8D8',
  },
  statusPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingPill: {
    backgroundColor: '#FFF3E0',
  },
  pendingPillText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#FF9500',
  },
  soldPill: {
    backgroundColor: '#F5F5F5',
  },
  soldPillText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 11,
    color: '#999999',
  },

  // ─── Message list ─────────────────────────────────────────
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    flexGrow: 1,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#E0E0E0',
  },
  dateSeparatorText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 11,
    color: '#999999',
    marginHorizontal: 10,
  },
  bubbleWrap: {
    marginBottom: 2,
    maxWidth: '75%',
  },
  bubbleWrapMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  bubbleWrapTheirs: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleMine: {
    backgroundColor: '#A4C8D8',
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 0.5,
    borderColor: '#F0F0F0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  bubbleText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleTextMine: {
    color: '#FFFFFF',
  },
  bubbleTextTheirs: {
    color: '#1A1A1A',
  },
  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
  },

  // ─── Empty state ──────────────────────────────────────────
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
    marginTop: 12,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyChatSubtitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 32,
  },
  quickReplies: {
    marginTop: 24,
    gap: 10,
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },
  quickReplyPill: {
    backgroundColor: '#F0F0F0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  quickReplyText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
  },

  // ─── Input bar ────────────────────────────────────────────
  pendingImageContainer: {
    marginHorizontal: 12,
    marginBottom: 8,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  pendingImagePreview: {
    width: 80,
    height: 80,
    borderRadius: 10,
    backgroundColor: '#F0F0F0',
  },
  pendingImageRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1A1A1A',
    borderRadius: 11,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.5,
    borderTopColor: '#F0F0F0',
  },
  attachButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    marginHorizontal: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 36,
    maxHeight: 120,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
});
