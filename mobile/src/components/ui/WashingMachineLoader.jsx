import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

const WashingMachineLoader = ({ text = "Loading..." }) => {
  const machineX = useSharedValue(0);
  const drumRotation = useSharedValue(0);
  const waterY = useSharedValue(0);
  
  // Bubbles
  const b1Y = useSharedValue(0);
  const b1O = useSharedValue(0);
  const b1S = useSharedValue(1);
  const b2Y = useSharedValue(0);
  const b2O = useSharedValue(0); 
  const b2S = useSharedValue(1);
  const b3Y = useSharedValue(0);
  const b3O = useSharedValue(0);
  const b3S = useSharedValue(1);
  const textOpacity = useSharedValue(0.5);

  useEffect(() => {
    machineX.value = withRepeat(
      withSequence(
        withTiming(-1.5, { duration: 200 }),
        withTiming(1.5, { duration: 200 }),
        withTiming(0, { duration: 100 })
      ),
      -1,
      true
    );

    drumRotation.value = withRepeat(
      withTiming(360, { duration: 1200, easing: Easing.linear }),
      -1,
      false
    );

    waterY.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 400 }),
        withTiming(2, { duration: 400 })
      ),
      -1,
      true
    );

    textOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750 }),
        withTiming(0.5, { duration: 750 })
      ),
      -1,
      true
    );

    const startBubble = (y, o, s, delay) => {
      setTimeout(() => {
        y.value = withRepeat(
          withSequence(
            withTiming(-14, { duration: 750, easing: Easing.out(Easing.ease) }),
            withTiming(-22, { duration: 750, easing: Easing.out(Easing.ease) })
          ),
          -1,
          false
        );
        o.value = withRepeat(
          withSequence(
            withTiming(1, { duration: 750 }),
            withTiming(0, { duration: 750 })
          ),
          -1,
          false
        );
        s.value = withRepeat(
          withSequence(
            withTiming(1.2, { duration: 750 }),
            withTiming(0.6, { duration: 750 })
          ),
          -1,
          false
        );
      }, delay);
    };

    startBubble(b1Y, b1O, b1S, 0);
    startBubble(b2Y, b2O, b2S, 400);
    startBubble(b3Y, b3O, b3S, 800);
  }, []);

  const machineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: machineX.value }]
  }));

  const drumStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${drumRotation.value}deg` }]
  }));

  const waterStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: waterY.value }]
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value
  }));

  const getBubbleStyle = (y, o, s) => useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: s.value }],
    opacity: o.value
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.machineBody, machineStyle]}>
        <View style={styles.topPanel}>
          <View style={styles.lightsContainer}>
            <View style={styles.successLight} />
            <View style={styles.warningLight} />
          </View>
          <View style={styles.panelScreen} />
        </View>

        <View style={styles.drumWindow}>
          <Animated.View style={[styles.drumInterior, drumStyle]}>
            <View style={styles.drumPaddle1}>
              <View style={styles.paddleInner} />
            </View>
            <View style={styles.drumPaddle2}>
              <View style={styles.paddleInner} />
            </View>
            <View style={styles.drumPaddle3}>
              <View style={styles.paddleInner} />
            </View>
          </Animated.View>

          <Animated.View style={[styles.water, waterStyle]} />

          <Animated.View style={[styles.bubble, { left: '25%', bottom: '30%' }, getBubbleStyle(b1Y, b1O, b1S)]} />
          <Animated.View style={[styles.bubble, { left: '45%', bottom: '30%' }, getBubbleStyle(b2Y, b2O, b2S)]} />
          <Animated.View style={[styles.bubble, { left: '65%', bottom: '30%' }, getBubbleStyle(b3Y, b3O, b3S)]} />
        </View>

        <View style={styles.doorHandle} />
        
        <View style={styles.footLeft} />
        <View style={styles.footRight} />
      </Animated.View>

      <Animated.Text style={[styles.loadingText, textStyle]}>
        {text}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  machineBody: {
    width: 112,
    height: 128,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    position: 'relative',
  },
  topPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  lightsContainer: {
    flexDirection: 'row',
    gap: 4,
  },
  successLight: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  warningLight: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.warning,
  },
  panelScreen: {
    width: 32,
    height: 6,
    borderRadius: 4,
    backgroundColor: colors.disabled,
  },
  drumWindow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 3,
    borderColor: 'rgba(37, 99, 235, 0.3)',
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    overflow: 'hidden',
  },
  drumInterior: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    position: 'absolute',
  },
  drumPaddle1: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drumPaddle2: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '60deg' }],
  },
  drumPaddle3: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '120deg' }],
  },
  paddleInner: {
    width: 2,
    height: '100%',
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
  },
  water: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: '50%',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  bubble: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.4)',
  },
  doorHandle: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: [{ translateY: -12 }],
    width: 6,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(156, 163, 175, 0.3)',
  },
  footLeft: {
    position: 'absolute',
    bottom: -4,
    left: 8,
    width: 12,
    height: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  footRight: {
    position: 'absolute',
    bottom: -4,
    right: 8,
    width: 12,
    height: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: 'rgba(156, 163, 175, 0.2)',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 24,
  }
});

export default WashingMachineLoader;
