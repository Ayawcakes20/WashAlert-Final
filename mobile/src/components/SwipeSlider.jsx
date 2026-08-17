import React, { useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 32;
const KNOB_SIZE = 52;
const SWIPE_RANGE = SLIDER_WIDTH - KNOB_SIZE - 8;

/**
 * SwipeSlider component — Grab/Lalamove style.
 * Uses double-chevron knob with pulse animation for clear swipe affordance.
 *
 * Props:
 *   label: string        - Text displayed on the slider
 *   onComplete: function - Fired when swipe is successful
 *   color: string        - Theme color (default: primary)
 *   disabled: boolean    - Disable interaction
 */
const SwipeSlider = ({ label, onComplete, color = colors.primary, disabled = false }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef(null);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    const id = translateX.addListener(({ value }) => {
      currentXRef.current = value;
    });
    return () => translateX.removeListener(id);
  }, [translateX]);

  useEffect(() => {
    disabledRef.current = disabled;

    if (pulseLoopRef.current) {
      pulseLoopRef.current.stop();
      pulseLoopRef.current = null;
    }

    if (!disabled) {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.1, duration: 750, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      Animated.timing(pulseScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }

    return () => {
      if (pulseLoopRef.current) {
        pulseLoopRef.current.stop();
      }
    };
  }, [disabled, pulseScale]);

  const handleReset = useCallback(() => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: false }).start();
  }, [translateX]);

  const handleComplete = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (typeof onComplete === 'function') {
      onComplete();
    }
    setTimeout(() => {
      handleReset();
    }, 1000);
  }, [handleReset, onComplete]);

  // Gesture.Pan() (react-native-gesture-handler) claims the touch at the native level,
  // which prevents Android's system "swipe from bottom edge" gesture navigation from
  // stealing the touch and kicking the user out of the app - a real risk here since this
  // slider sits at the bottom of the screen. runOnJS(true) runs callbacks as plain JS
  // functions (no react-native-reanimated/worklets involved).
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      if (disabledRef.current) return;
      startXRef.current = currentXRef.current;
    })
    .onUpdate((event) => {
      if (disabledRef.current) return;
      const newVal = startXRef.current + event.translationX;
      translateX.setValue(Math.min(Math.max(newVal, 0), SWIPE_RANGE));
    })
    .onEnd((_event, success) => {
      if (disabledRef.current) return;
      if (success && currentXRef.current > SWIPE_RANGE * 0.85) {
        Animated.spring(translateX, { toValue: SWIPE_RANGE, useNativeDriver: false }).start();
        handleComplete();
      } else {
        handleReset();
      }
    });

  const animatedBgColor = translateX.interpolate({
    inputRange: [0, SWIPE_RANGE],
    outputRange: ['rgba(255,255,255,0)', 'rgba(255,255,255,0.22)'],
  });

  const textOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_RANGE * 0.6, SWIPE_RANGE],
    outputRange: [1, 0, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: disabled ? colors.disabled : color }]}>
      <Animated.View style={[styles.backgroundOverlay, { backgroundColor: animatedBgColor }]} />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }, { scale: pulseScale }] }]}>
          <View style={styles.knobInner}>
            <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} />
            <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} style={{ marginLeft: -10 }} />
          </View>
        </Animated.View>
      </GestureDetector>

      <Animated.Text style={[styles.label, { opacity: textOpacity }]} pointerEvents="none">
        {label}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 60,
    width: SLIDER_WIDTH,
    borderRadius: 30,
    justifyContent: 'center',
    paddingHorizontal: 4,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  knobInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});

export default SwipeSlider;
