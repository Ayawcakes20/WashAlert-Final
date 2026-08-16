import React, { useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
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
  const translateX = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const isDisabled = useSharedValue(disabled);

  useEffect(() => {
    isDisabled.value = disabled;
    if (!disabled) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 750 }),
          withTiming(1, { duration: 750 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [disabled, isDisabled, pulseScale]);

  const handleReset = useCallback(() => {
    translateX.value = withSpring(0);
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

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      if (isDisabled.value) return;
      const newVal = startX.value + event.translationX;
      translateX.value = Math.min(Math.max(newVal, 0), SWIPE_RANGE);
    })
    .onEnd(() => {
      if (isDisabled.value) return;
      if (translateX.value > SWIPE_RANGE * 0.85) {
        translateX.value = withSpring(SWIPE_RANGE);
        handleComplete();
      } else {
        handleReset();
      }
    });

  const animatedKnobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: pulseScale.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      translateX.value,
      [0, SWIPE_RANGE],
      ['transparent', 'rgba(255,255,255,0.22)']
    );
    return { backgroundColor };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    const opacity = 1 - translateX.value / (SWIPE_RANGE * 0.6);
    return { opacity: Math.max(opacity, 0) };
  });

  return (
    <View style={[styles.container, { backgroundColor: disabled ? colors.disabled : color }]}>
      <Animated.View style={[styles.backgroundOverlay, animatedBgStyle]} />

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.knob, animatedKnobStyle]}>
          <View style={styles.knobInner}>
            <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} />
            <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} style={{ marginLeft: -10 }} />
          </View>
        </Animated.View>
      </GestureDetector>

      <Animated.Text style={[styles.label, animatedTextStyle]} pointerEvents="none">
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
