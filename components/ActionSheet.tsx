import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { useEffect, useRef } from 'react';

export type ActionSheetOption = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type ActionSheetProps = {
  visible: boolean;
  title?: string;
  options: ActionSheetOption[];
  onClose: () => void;
  showCancel?: boolean;
};

export default function ActionSheet({
  visible,
  title,
  options,
  onClose,
  showCancel = false,
}: ActionSheetProps) {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 300,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Animated.View style={[styles.backdrop, { opacity }]} />
      </Pressable>
      <Animated.View
        style={[styles.sheet, { transform: [{ translateY }] }]}
      >
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Title */}
        {title ? (
          <Text style={styles.title}>{title}</Text>
        ) : null}

        {/* Options */}
        {options.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.option,
              index === options.length - 1 && styles.optionLast,
              option.disabled && styles.optionDisabled,
            ]}
            onPress={() => {
              if (option.disabled) return;
              onClose();
              // Small delay so sheet closes before action fires
              setTimeout(option.onPress, 150);
            }}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.optionText,
                option.destructive && styles.optionTextDestructive,
                option.disabled && styles.optionTextDisabled,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
        {showCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 16,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 15,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    marginBottom: 4,
  },
  option: {
    paddingVertical: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
    alignItems: 'center',
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionDisabled: {
    opacity: 0.4,
  },
  optionText: {
    fontFamily: 'Quicksand_600SemiBold',
    fontSize: 16,
    color: '#1A1A1A',
  },
  optionTextDestructive: {
    color: '#E05555',
  },
  optionTextDisabled: {
    color: '#999999',
  },
  cancelButton: {
    marginTop: 8,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
  },
  cancelText: {
    fontFamily: 'Quicksand_700Bold',
    fontSize: 16,
    color: '#1A1A1A',
  },
});
