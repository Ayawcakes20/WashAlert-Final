import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, PanResponder } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SLIDER_WIDTH = SCREEN_WIDTH - 32;
const KNOB_SIZE = 52;
const SWIPE_RANGE = SLIDER_WIDTH - KNOB_SIZE - 8;

/**
 * SwipeSlider component — Grab/Lalamove style.
 * Uses standard React Native Animated + PanResponder for 100% reliability across all devices.
 */
const SwipeSlider = ({ label, onComplete, color = colors.primary, disabled = false }) => {
  const pan = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!disabled) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.08, duration: 750, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1, duration: 750, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseScale.setValue(1);
    }
  }, [disabled, pulseScale]);

  const handleReset = () => {
    Animated.spring(pan, {
      toValue: 0,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (typeof onComplete === 'function') {
      onComplete();
    }
    setTimeout(() => {
      handleReset();
    }, 1000);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderMove: (_, gestureState) => {
        if (disabled) return;
        const nextX = Math.max(0, Math.min(gestureState.dx, SWIPE_RANGE));
        pan.setValue(nextX);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (disabled) return;
        if (gestureState.dx > SWIPE_RANGE * 0.8) {
          Animated.timing(pan, {
            toValue: SWIPE_RANGE,
            duration: 150,
            useNativeDriver: true,
          }).start(() => handleComplete());
        } else {
          handleReset();
        }
      },
    })
  ).current;

  const textOpacity = pan.interpolate({
    inputRange: [0, SWIPE_RANGE * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, { backgroundColor: disabled ? colors.disabled : color }]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            transform: [
              { translateX: pan },
              { scale: pulseScale },
            ],
          },
        ]}
      >
        <View style={styles.knobInner}>
          <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} />
          <Ionicons name="chevron-forward" size={18} color={disabled ? colors.disabled : color} style={{ marginLeft: -10 }} />
        </View>
      </Animated.View>

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
