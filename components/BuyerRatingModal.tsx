import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../app/_layout';

type BuyerRatingModalProps = {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingType: 'listing' | 'buy_nothing';
  sellerId: string;
  sellerName: string;
  onConfirmed?: () => void;
};

type RatingTag = {
  id: string;
  tag_key: string;
  label: string;
};

export default function BuyerRatingModal({
  visible,
  onClose,
  listingId,
  listingType,
  sellerId,
  sellerName,
  onConfirmed,
}: BuyerRatingModalProps) {
  const { session } = useAuth();

  const [step, setStep] = useState<'rate' | 'confirm' | 'success'>('rate');
  const [stars, setStars] = useState(1);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [ratingsRowId, setRatingsRowId] = useState<string | null>(null);
  const [ratingTags, setRatingTags] = useState<RatingTag[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyConfirmed, setAlreadyConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const buyerCheckmarkScale = useRef(new Animated.Value(0)).current;
  const buyerConfettiPieces = Array.from({ length: 52 }, () => ({
    x: useRef(new Animated.Value(Math.random())).current,
    y: useRef(new Animated.Value(-20)).current,
    opacity: useRef(new Animated.Value(0.6 + Math.random() * 0.4)).current,
    rotate: useRef(new Animated.Value(0)).current,
    width: Math.random() * 10 + 5,
    height: Math.random() * 6 + 4,
    color: ['#A4C8D8', '#7BB8CC', '#C8E6F0', '#5BA3BE', '#E0F3FA'][
      Math.floor(Math.random() * 5)
    ],
  }));

  // Reset state when the modal closes.
  useEffect(() => {
    if (!visible) {
      setStep('rate');
      setStars(1);
      setSelectedTags([]);
      setComment('');
      setRatingsRowId(null);
      setAlreadyConfirmed(false);
    }
  }, [visible]);

  // Fetch tags + ratings row when the modal opens.
  useEffect(() => {
    if (!visible) return;

    const fetchRatingTags = async () => {
      const { data } = await supabase
        .from('rating_tags')
        .select('id, tag_key, label')
        .eq('is_active', true)
        .order('sort_order');
      if (data) setRatingTags(data);
    };

    const fetchRatingsRow = async () => {
      if (!session?.user?.id) return;
      setLoading(true);
      const { data } = await supabase
        .from('ratings')
        .select('id, status')
        .eq('listing_id', listingId)
        .eq('listing_type', listingType)
        .eq('seller_id', sellerId)
        .eq('buyer_id', session.user.id)
        .maybeSingle();

      if (!data) {
        // Not found → expired or never created
        setAlreadyConfirmed(true);
      } else if (data.status === 'confirmed') {
        setAlreadyConfirmed(true);
      } else if (data.status === 'pending_buyer_confirmation') {
        setRatingsRowId(data.id);
      } else {
        // Any other status (e.g. expired) — treat as already handled
        setAlreadyConfirmed(true);
      }
      setLoading(false);
    };

    fetchRatingTags();
    fetchRatingsRow();
  }, [visible, listingId, listingType, sellerId, session?.user?.id]);

  const triggerBuyerSuccessAnimation = () => {
    buyerCheckmarkScale.setValue(0);
    buyerConfettiPieces.forEach((p) => {
      p.y.setValue(-20);
      p.opacity.setValue(0.6 + Math.random() * 0.4);
      p.rotate.setValue(0);
    });

    Animated.spring(buyerCheckmarkScale, {
      toValue: 1,
      damping: 10,
      stiffness: 200,
      useNativeDriver: true,
    }).start();

    buyerConfettiPieces.forEach((p, i) => {
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: 700,
          duration: 1500 + Math.random() * 500,
          delay: i * 30,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: 1500 + Math.random() * 500,
          delay: i * 30 + 800,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: Math.random() > 0.5 ? 360 : -360,
          duration: 1500,
          delay: i * 30,
          useNativeDriver: true,
        }),
      ]).start();
    });

    setTimeout(() => {
      onClose();
    }, 2200);
  };

  const handleSubmitBuyerRating = async () => {
    if (!ratingsRowId || !session?.user?.id || submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('ratings')
        .update({
          buyer_rating: stars,
          buyer_tags: selectedTags,
          buyer_comment: comment.trim() || null,
          buyer_rated_at: new Date().toISOString(),
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', ratingsRowId);

      if (error) throw error;

      setStep('success');
      triggerBuyerSuccessAnimation();
      onConfirmed?.();
    } catch (err) {
      console.error('Error submitting buyer rating:', err);
      Alert.alert('Error', 'Could not submit your rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (step !== 'success') {
          onClose();
        }
      }}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: '#FAFAFA' }}
        edges={['top']}
      >
        {/* Header — hidden on success */}
        {step !== 'success' && !alreadyConfirmed && (
          <View style={styles.ratingHeader}>
            {step === 'rate' ? (
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setStep('rate')}>
                <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
              </TouchableOpacity>
            )}
            <Text style={styles.ratingHeaderTitle}>
              {step === 'rate' ? 'Rate your seller' : 'Confirm & Submit'}
            </Text>
            <View style={{ width: 24 }} />
          </View>
        )}

        {alreadyConfirmed && (
          <View style={styles.ratingHeader}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#1A1A1A" />
            </TouchableOpacity>
            <Text style={styles.ratingHeaderTitle}> </Text>
            <View style={{ width: 24 }} />
          </View>
        )}

        {/* Loading state (initial ratings row fetch) */}
        {loading && !alreadyConfirmed && step !== 'success' && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A4C8D8" />
          </View>
        )}

        {/* Already confirmed state */}
        {!loading && alreadyConfirmed && (
          <View style={styles.alreadyConfirmedContainer}>
            <Ionicons name="checkmark-circle" size={56} color="#A4C8D8" />
            <Text style={styles.alreadyConfirmedTitle}>Already confirmed</Text>
            <Text style={styles.alreadyConfirmedBody}>
              This transaction has already been confirmed.
            </Text>
            <TouchableOpacity
              style={styles.alreadyConfirmedButton}
              onPress={onClose}
            >
              <Text style={styles.alreadyConfirmedButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step: Rate */}
        {!loading && !alreadyConfirmed && step === 'rate' && (
          <ScrollView
            contentContainerStyle={styles.ratingContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Stars */}
            <Text style={styles.ratingLabel}>Your rating</Text>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setStars(star)}
                >
                  <Ionicons
                    name={star <= stars ? 'star' : 'star-outline'}
                    size={36}
                    color="#FFB800"
                  />
                </TouchableOpacity>
              ))}
            </View>

            {/* Tags */}
            <Text style={styles.ratingLabel}>
              Add tags{' '}
              <Text style={styles.ratingOptional}>(optional)</Text>
            </Text>
            <View style={styles.tagsGrid}>
              {ratingTags.map((tag) => {
                const selected = selectedTags.includes(tag.tag_key);
                return (
                  <TouchableOpacity
                    key={tag.tag_key}
                    style={[
                      styles.tagPill,
                      selected && styles.tagPillSelected,
                    ]}
                    onPress={() =>
                      setSelectedTags((prev) =>
                        selected
                          ? prev.filter((t) => t !== tag.tag_key)
                          : [...prev, tag.tag_key]
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.tagPillText,
                        selected && styles.tagPillTextSelected,
                      ]}
                    >
                      {tag.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Comment */}
            <Text style={styles.ratingLabel}>
              Leave a comment{' '}
              <Text style={styles.ratingOptional}>(optional)</Text>
            </Text>
            <TextInput
              style={styles.ratingCommentInput}
              placeholder="Share your experience..."
              placeholderTextColor="#BBBBBB"
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              maxLength={500}
            />

            <TouchableOpacity
              style={styles.ratingNextButton}
              onPress={() => setStep('confirm')}
            >
              <Text style={styles.ratingNextButtonText}>Continue</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Step: Confirm */}
        {!loading && !alreadyConfirmed && step === 'confirm' && (
          <View style={styles.ratingContent}>
            <Text style={styles.confirmTitle}>Ready to submit?</Text>
            <Text style={styles.confirmBody}>
              You are about to confirm your transaction with{' '}
              <Text style={styles.confirmBold}>{sellerName || 'the seller'}</Text>
              {' '}and submit your rating. Once confirmed, both ratings will
              be visible to other users.
            </Text>

            {/* Rating summary */}
            <View style={styles.confirmSummary}>
              <View style={styles.confirmStarsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= stars ? 'star' : 'star-outline'}
                    size={20}
                    color="#FFB800"
                  />
                ))}
              </View>
              {selectedTags.length > 0 && (
                <Text style={styles.confirmTags}>
                  {selectedTags
                    .map(
                      (key) =>
                        ratingTags.find((t) => t.tag_key === key)?.label
                    )
                    .filter(Boolean)
                    .join(', ')}
                </Text>
              )}
              {comment.trim() && (
                <Text style={styles.confirmComment}>
                  "{comment.trim()}"
                </Text>
              )}
            </View>

            <TouchableOpacity
              style={styles.ratingNextButton}
              onPress={handleSubmitBuyerRating}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.ratingNextButtonText}>
                  Confirm & Submit
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <View style={styles.successContainer}>
            {buyerConfettiPieces.map((piece, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.confettiPiece,
                  {
                    left: `${piece.x._value * 100}%`,
                    width: piece.width,
                    height: piece.height,
                    backgroundColor: piece.color,
                    transform: [
                      { translateY: piece.y },
                      {
                        rotate: piece.rotate.interpolate({
                          inputRange: [-360, 360],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                    ],
                    opacity: piece.opacity,
                  },
                ]}
              />
            ))}
            <Animated.View
              style={[
                styles.successCheckmark,
                { transform: [{ scale: buyerCheckmarkScale }] },
              ]}
            >
              <Ionicons name="checkmark" size={52} color="#FFFFFF" />
            </Animated.View>
            <Text style={styles.successTitle}>Thank you!</Text>
            <Text style={styles.successSubtitle}>
              Your rating has been submitted
            </Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // ─── Rating modal ────────────────────────────────────────
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  ratingHeaderTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  ratingContent: {
    padding: 24,
  },
  ratingLabel: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 12,
    marginTop: 20,
  },
  ratingOptional: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  tagPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
  },
  tagPillSelected: {
    borderColor: '#A4C8D8',
    backgroundColor: '#EBF5F9',
  },
  tagPillText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
  },
  tagPillTextSelected: {
    color: '#A4C8D8',
  },
  ratingCommentInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 14,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
    minHeight: 90,
    marginBottom: 4,
  },
  ratingNextButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  ratingNextButtonText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  confirmTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 20,
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  confirmBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#666666',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  confirmBold: {
    fontFamily: 'Quicksand_700Bold',
    color: '#1A1A1A',
  },
  confirmSummary: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    gap: 8,
  },
  confirmStarsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  confirmTags: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#666666',
  },
  confirmComment: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#666666',
    fontStyle: 'italic',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confettiPiece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
  successCheckmark: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#A4C8D8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 32,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  successSubtitle: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#999999',
  },

  // ─── Loading ─────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Already confirmed ───────────────────────────────────
  alreadyConfirmedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  alreadyConfirmedTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 20,
    color: '#1A1A1A',
    marginTop: 16,
  },
  alreadyConfirmedBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  alreadyConfirmedButton: {
    marginTop: 32,
    backgroundColor: '#A4C8D8',
    borderRadius: 14,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  alreadyConfirmedButtonText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    color: '#FFFFFF',
  },
});
