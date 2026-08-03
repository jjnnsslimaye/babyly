import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

type ReportModalProps = {
  visible: boolean;
  onClose: () => void;
  reportType: 'listing' | 'message' | 'conversation';
  targetId: string;
  reporterId: string;
};

const LISTING_REASONS = [
  'Prohibited or unsafe item',
  'Suspected scam or fraud',
  'Spam or duplicate listing',
  'Inappropriate content',
  'Item already sold',
  'Other',
];

const MESSAGE_REASONS = [
  'Harassment or threats',
  'Suspected scam or fraud',
  'Spam',
  'Inappropriate content',
  'Suspicious behavior',
  'Other',
];

export default function ReportModal({
  visible,
  onClose,
  reportType,
  targetId,
  reporterId,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
      setComment('');
      setSubmitting(false);
      setSubmitted(false);
    }
  }, [visible]);

  const reasons = reportType === 'listing' ? LISTING_REASONS : MESSAGE_REASONS;

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('reports').insert({
        reporter_id: reporterId,
        report_type: reportType,
        target_id: targetId,
        reason: selectedReason,
        comment: comment.trim() || null,
      });
      if (error) throw error;
      setSubmitted(true);
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      console.error('Error submitting report:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !!selectedReason && !submitting;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report</Text>
          <View style={{ width: 24 }} />
        </View>

        {submitted ? (
          <View style={styles.successState}>
            <Ionicons
              name="checkmark-circle"
              size={56}
              color="#A4C8D8"
              style={styles.successIcon}
            />
            <Text style={styles.successTitle}>Thank you</Text>
            <Text style={styles.successBody}>
              Your report has been submitted. We review all reports to keep
              Babyly safe for everyone.
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Reasons */}
            <Text style={styles.subtitle}>What's the issue?</Text>
            <View style={styles.reasonList}>
              {reasons.map((reason, index) => {
                const selected = selectedReason === reason;
                const isLast = index === reasons.length - 1;
                return (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonRow,
                      isLast && styles.reasonRowLast,
                    ]}
                    onPress={() => setSelectedReason(reason)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.reasonText}>{reason}</Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? '#A4C8D8' : '#E0E0E0'}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Comment */}
            <Text style={styles.commentLabel}>
              Additional details (optional)
            </Text>
            <TextInput
              style={styles.commentInput}
              value={comment}
              onChangeText={setComment}
              placeholder="Share more context..."
              placeholderTextColor="#BBBBBB"
              multiline
              textAlignVertical="top"
              maxLength={300}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                !canSubmit && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>

            {/* Anonymous note */}
            <View style={styles.anonymousRow}>
              <Ionicons
                name="shield-checkmark-outline"
                size={14}
                color="#999999"
              />
              <Text style={styles.anonymousText}>
                Your report is anonymous
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // ─── Header ───────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },

  // ─── Body ─────────────────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  subtitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 14,
    color: '#1A1A1A',
    marginBottom: 12,
  },

  // ─── Reasons ──────────────────────────────────────────────
  reasonList: {
    // Container so borderBottom hairlines align with subtitle
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  reasonRowLast: {
    borderBottomWidth: 0,
  },
  reasonText: {
    flex: 1,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 15,
    color: '#1A1A1A',
    marginRight: 12,
  },

  // ─── Comment ──────────────────────────────────────────────
  commentLabel: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 13,
    color: '#999999',
    marginTop: 20,
    marginBottom: 8,
  },
  commentInput: {
    height: 80,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#1A1A1A',
  },

  // ─── Submit ───────────────────────────────────────────────
  submitButton: {
    backgroundColor: '#A4C8D8',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: '#CCCCCC',
  },
  submitButtonText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },

  // ─── Anonymous ────────────────────────────────────────────
  anonymousRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  anonymousText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 12,
    color: '#999999',
  },

  // ─── Success state ────────────────────────────────────────
  successState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  successIcon: {
    marginBottom: 16,
  },
  successTitle: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 22,
    color: '#1A1A1A',
    marginBottom: 8,
  },
  successBody: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
});
