import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// ── Brand colors (stand-alone so no dependency on theme) ──────────────────
const BRAND = {
  navy:    '#1A2B4A',
  blue:    '#2563EB',
  teal:    '#0EA5E9',
  mint:    '#10B981',
  amber:   '#F59E0B',
  offwhite:'#F0F6FF',
  slate:   '#64748B',
  white:   '#FFFFFF',
};

// ── Slide definitions ─────────────────────────────────────────────────────
const SLIDES = [
  {
    id: '1',
    panelBg:    BRAND.navy,
    panelAccent: BRAND.blue,
    icon:       'washing-machine',
    iconColor:  BRAND.white,
    badge:      'BOOK',
    badgeColor: BRAND.teal,
    title:      'Clean clothes,\nzero effort.',
    body:       'Book wash, dry, or fold services at any of our 10 branches — right from your phone.',
    cta:        'Continue',
  },
  {
    id:         '2',
    panelBg:    BRAND.blue,
    panelAccent:BRAND.teal,
    icon:       'map-marker-radius',
    iconColor:  BRAND.white,
    badge:      'TRACK',
    badgeColor: BRAND.mint,
    title:      'Know where\nyour laundry is.',
    body:       'Live status updates from pickup to your doorstep. Always in the loop.',
    cta:        'Continue',
  },
  {
    id:         '3',
    panelBg:    '#0A2540',
    panelAccent:BRAND.mint,
    icon:       'contactless-payment',
    iconColor:  BRAND.white,
    badge:      'PAY',
    badgeColor: BRAND.amber,
    title:      'Pay instantly\nwith GCash.',
    body:       'Secure, cashless payments via PayMongo. Quick checkout, every time.',
    cta:        'Get Started',
  },
];

// ── Visual panel for each slide ───────────────────────────────────────────
function SlidePanel({ slide, index, scrollX }) {
  // Subtle parallax on the icon
  const translateY = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [30, 0, -30],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange: [(index - 0.5) * width, index * width, (index + 0.5) * width],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[panel.root, { backgroundColor: slide.panelBg }]}>

      {/* Large decorative ring — top right */}
      <View style={[panel.ringOuter, { borderColor: slide.panelAccent + '30' }]}>
        <View style={[panel.ringInner, { borderColor: slide.panelAccent + '20' }]} />
      </View>

      {/* Small dot — bottom left */}
      <View style={[panel.dot, { backgroundColor: slide.panelAccent + '40' }]} />

      {/* Logo mark + badge ─────────────────────────────────── */}
      <Animated.View style={[panel.center, { opacity, transform: [{ translateY }] }]}>

        {/* Badge pill above icon */}
        <View style={[panel.badgePill, { backgroundColor: slide.badgeColor }]}>
          <Text style={panel.badgeText}>{slide.badge}</Text>
        </View>

        {/* Main icon container */}
        <View style={[panel.iconBox, { borderColor: slide.panelAccent + '50' }]}>
          <View style={[panel.iconInner, { backgroundColor: slide.panelAccent + '20' }]}>
            <MaterialCommunityIcons name={slide.icon} size={72} color={slide.iconColor} />
          </View>
        </View>

        {/* WashAlert wordmark below icon */}
        <View style={panel.wordmarkRow}>
          <Image
            source={require('../../../assets/images/icon.png')}
            style={panel.logoMini}
            resizeMode="contain"
          />
          <Text style={panel.wordmark}>WashAlert</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const panel = StyleSheet.create({
  root: {
    width,
    height: height * 0.50,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Decorative circles
  ringOuter: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    top: -60,
    right: -80,
  },
  ringInner: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    top: 50,
    right: 50,
  },
  dot: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    bottom: -20,
    left: -20,
  },
  // Content
  center: { alignItems: 'center', gap: 16 },
  badgePill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: BRAND.navy,
    letterSpacing: 2,
  },
  iconBox: {
    width: 140,
    height: 140,
    borderRadius: 40,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  iconInner: {
    width: 110,
    height: 110,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  logoMini: {
    width: 22,
    height: 22,
    borderRadius: 6,
    opacity: 0.8,
  },
  wordmark: {
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
});

// ── Main component ────────────────────────────────────────────────────────
const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const isLast = currentIndex === SLIDES.length - 1;
  const slide  = SLIDES[currentIndex];

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0] != null) setCurrentIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goNext = () => {
    if (isLast) {
      navigation.navigate('Login');
    } else {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  // Animate the sheet accent line to follow slide color
  const accentColor = scrollX.interpolate({
    inputRange: SLIDES.map((_, i) => i * width),
    outputRange: SLIDES.map(s => s.panelAccent),
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={slide.panelBg} translucent />

      {/* ── Top bar (skip) ─────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {!isLast ? (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.7}
          >
            <Text style={styles.skipTxt}>Skip</Text>
          </TouchableOpacity>
        ) : <View />}
        {/* Step counter */}
        <View style={styles.stepCounter}>
          <Text style={styles.stepTxt}>{currentIndex + 1} / {SLIDES.length}</Text>
        </View>
      </View>

      {/* ── Slides: visual panels ───────────────────────────────── */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        style={{ height: height * 0.50, flexGrow: 0 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <SlidePanel slide={item} index={index} scrollX={scrollX} />
        )}
        scrollEnabled={true}
      />

      {/* ── Bottom content card ─────────────────────────────────── */}
      <View style={[styles.card, { flex: 1, paddingBottom: insets.bottom + 20 }]}>

        {/* Colored accent line */}
        <Animated.View style={[styles.accentBar, { backgroundColor: accentColor }]} />

        {/* Progress dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => {
            const w = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [6, 20, 6],
              extrapolate: 'clamp',
            });
            const bg = scrollX.interpolate({
              inputRange: [(i - 1) * width, i * width, (i + 1) * width],
              outputRange: [BRAND.slate + '50', BRAND.navy, BRAND.slate + '50'],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View key={i} style={[styles.dot, { width: w, backgroundColor: bg }]} />
            );
          })}
        </View>

        {/* Title */}
        <Text style={styles.title}>{slide.title}</Text>

        {/* Body */}
        <Text style={styles.body}>{slide.body}</Text>

        {/* CTA row */}
        <View style={styles.ctaRow}>
          {/* Back arrow (not on first slide) */}
          {currentIndex > 0 ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true })}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={20} color={BRAND.slate} />
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}

          {/* Next / Get Started */}
          <TouchableOpacity
            style={[styles.ctaBtn, { backgroundColor: slide.panelBg }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaTxt}>{slide.cta}</Text>
            <Ionicons
              name={isLast ? 'checkmark-circle-outline' : 'arrow-forward'}
              size={18}
              color={BRAND.white}
            />
          </TouchableOpacity>
        </View>

        {/* Already have account */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.loginRow}
          activeOpacity={0.7}
        >
          <Text style={styles.loginTxt}>
            Already have an account?{' '}
            <Text style={[styles.loginLink, { color: slide.panelBg }]}>Log in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BRAND.offwhite,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  skipBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  skipTxt: { fontSize: 13, fontWeight: '600', color: BRAND.white },
  stepCounter: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  stepTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },

  // Bottom card
  card: {
    flex: 1,
    backgroundColor: BRAND.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 28,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 12,
  },
  accentBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
    marginTop: 6,
  },

  // Dots
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
  },
  dot: { height: 5, borderRadius: 3 },

  // Text
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: BRAND.navy,
    lineHeight: 38,
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  body: {
    fontSize: 15,
    lineHeight: 24,
    color: BRAND.slate,
    fontWeight: '400',
    marginBottom: 24,
  },

  // CTA
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: BRAND.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  ctaTxt: { fontSize: 15, fontWeight: '700', color: BRAND.white },

  // Login hint
  loginRow: { alignItems: 'center' },
  loginTxt: { fontSize: 13, color: BRAND.slate, textAlign: 'center' },
  loginLink: { fontWeight: '700' },
});

export default OnboardingScreen;