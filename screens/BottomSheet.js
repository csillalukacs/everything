import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 220;

export default function BottomSheet({ visible, onClose, onClosed, keyboardAvoiding, sheetStyle, children }) {
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Fire onClosed once the modal has fully unmounted, so callers can safely present
  // another modal without overlapping native transitions (which stick on iOS).
  const wasMounted = useRef(mounted);
  useEffect(() => {
    if (wasMounted.current && !mounted) onClosed?.();
    wasMounted.current = mounted;
  }, [mounted]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(translate, { toValue: 0, duration: ANIM_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(translate, { toValue: SCREEN_HEIGHT, duration: ANIM_DURATION, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => { if (finished) setMounted(false); });
    }
  }, [visible]);

  const sheet = (
    <Animated.View style={[sheetStyle, { transform: [{ translateY: translate }] }]}>
      {children}
    </Animated.View>
  );

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]} pointerEvents="none" />
        <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={onClose} />
        {keyboardAvoiding ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {sheet}
          </KeyboardAvoidingView>
        ) : sheet}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  overlayTop: {
    flex: 1,
  },
});
