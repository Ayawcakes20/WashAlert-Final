import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

/**
 * "There's more below" scroll signifier — a bottom-edge fade gradient with a
 * small down-chevron, shown only while the screen's content actually
 * overflows the viewport and hidden once the user reaches the real bottom.
 *
 * This is the pattern NN/G's "Illusion of Completeness" research and
 * mainstream UX guidance (LogRocket, UX Planet) converge on for this exact
 * problem: users stop scrolling when a screen *looks* complete, so a soft
 * fade that never covers content — rather than a native OS scrollbar users
 * routinely miss — is the standard fix. Purely a passive visual cue, not
 * interactive.
 *
 * Usage: pair with useScrollCue() and render as a sibling positioned at the
 * bottom of the screen, outside the ScrollView it's cueing:
 *   const { onScroll, onContentSizeChange, onLayout, showCue } = useScrollCue();
 *   <ScrollView onScroll={onScroll} scrollEventThrottle={16}
 *     onContentSizeChange={onContentSizeChange} onLayout={onLayout}>...</ScrollView>
 *   <ScrollCue visible={showCue} />
 */
const ScrollCue = ({ visible, color = colors.background, bottom = 0 }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [visible, opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom, opacity }]}
    >
      <LinearGradient
        colors={[`${color}00`, color]}
        style={styles.gradient}
      >
        <Ionicons name="chevron-down" size={16} color={colors.textTertiary} style={styles.chevron} />
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chevron: {
    marginBottom: 4,
  },
});

export default ScrollCue;
