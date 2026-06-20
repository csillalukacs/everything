import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { C } from '../shared/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const ANIM_DURATION = 220;
const SWIPE_CLOSE_THRESHOLD = 100;

export default function BottomSheet({ visible, onClose, onClosed, keyboardAvoiding, swipeToClose = true, sheetStyle, children }) {
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // Latest onClose, read from the gesture's JS callback so the memoized gesture stays stable.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  const dragGesture = useMemo(() => {
    const dragTo = (y) => translate.setValue(y);
    const springBack = () => Animated.timing(translate, {
      toValue: 0,
      duration: ANIM_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const close = () => closeRef.current?.();
    return Gesture.Pan()
      .runOnJS(true)
      .onUpdate((e) => {
        if (e.translationY > 0) dragTo(e.translationY);
      })
      .onEnd((e) => {
        if (e.translationY > SWIPE_CLOSE_THRESHOLD || e.velocityY > 600) close();
        else springBack();
      });
  }, []);

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

  // Break the grabber band out to the sheet's own edges regardless of its padding,
  // so the whole top strip (and corners) is a reliable drag target on every sheet.
  const flat = StyleSheet.flatten(sheetStyle) || {};
  const padTop = flat.paddingTop ?? flat.padding ?? 0;
  const padX = flat.paddingHorizontal ?? flat.padding ?? 0;

  const sheet = (
    <Animated.View style={[sheetStyle, { transform: [{ translateY: translate }] }]}>
      {swipeToClose && (
        <GestureDetector gesture={dragGesture}>
          <View style={[styles.grabberArea, { marginTop: -padTop, marginHorizontal: -padX }]}>
            <View style={styles.grabber} />
          </View>
        </GestureDetector>
      )}
      {children}
    </Animated.View>
  );

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.root}>
        <View style={styles.overlay}>
          <Animated.View style={[styles.backdrop, { opacity: backdrop }]} pointerEvents="none" />
          <TouchableOpacity style={styles.overlayTop} activeOpacity={1} onPress={onClose} />
          {keyboardAvoiding ? (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              {sheet}
            </KeyboardAvoidingView>
          ) : sheet}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
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
  // Full-width band reaching the sheet's top edge so the whole top strip (and the
  // rounded corners) is a reliable drag target, not just the little grabber line.
  // marginTop / marginHorizontal are applied inline to cancel the host sheet's padding.
  grabberArea: {
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
  },
});
