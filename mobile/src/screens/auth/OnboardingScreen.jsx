import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    icon: 'water-outline',
    title: 'Book Your Laundry',
    description: 'Schedule pickup and delivery from any of our 10 branches across Metro Manila. Anytime, anywhere.',
    color: colors.primary,
  },
  {
    id: '2',
    icon: 'location-outline',
    title: 'Real-Time Tracking',
    description: 'Track your laundry from wash to delivery. Know exactly when it\'s ready — no more guessing.',
    color: colors.accent,
  },
  {
    id: '3',
    icon: 'shield-checkmark-outline',
    title: 'Secure & Easy Payment',
    description: 'Pay conveniently with GCash or cash. Fast, safe, and hassle-free every time.',
    color: colors.success,
  },
];

const FEATURES = [
  { icon: 'time-outline', label: 'Fast Service' },
  { icon: 'bicycle-outline', label: 'Free Delivery' },
  { icon: 'sparkles-outline', label: 'Premium Care' },
  { icon: 'shield-checkmark-outline', label: 'Secure Pay' },
];

const BRANCHES = [
  "Makati", "BGC", "Quezon City", "Mandaluyong", "Pasig",
  "Parañaque", "Las Piñas", "Marikina", "Caloocan", "Pasay",
];

const OnboardingScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [currentSlide, setCurrentSlide] = useState(0);

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentSlide(viewableItems[0].index);
    }
  }).current;

  return (
    <View style={styles.container}>
      {/* Hero Section */}
      <LinearGradient
        colors={[colors.primary, colors.primary, colors.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.heroSection, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.heroContent}>
          <View style={styles.imageWrapper}>
            <Image 
              source={require('../../../assets/images/icon.png')}
              style={styles.logo} 
              resizeMode="contain" 
            />
          </View>
          <Text style={styles.heroTitle}>WashAlert</Text>
          <Text style={styles.heroSubtitle}>Your Laundry, Our Priority</Text>
          <Text style={styles.heroSubtext}>by Triplets LaundryHubs & SpeedyWash</Text>
        </View>
      </LinearGradient>

      <View style={[styles.mainContent, { paddingBottom: insets.bottom + 20 }]}>
        {/* Sliding Cards */}
        <View style={styles.sliderContainer}>
          <FlatList
            data={SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <View style={styles.slideCard}>
                  <View style={[styles.slideIconContainer, { backgroundColor: item.color + '1A' }]}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                  </View>
                  <View style={styles.slideTextContainer}>
                    <Text style={styles.slideTitle}>{item.title}</Text>
                    <Text style={styles.slideDesc}>{item.description}</Text>
                  </View>
                </View>
              </View>
            )}
          />
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentSlide ? styles.dotActive : null,
              ]}
            />
          ))}
        </View>

        {/* Features */}
        <View style={styles.featuresGrid}>
          {FEATURES.map((feature, i) => (
            <View key={i} style={styles.featureItem}>
              <View style={styles.featureIconBox}>
                <Ionicons name={feature.icon} size={24} color={colors.primary} />
              </View>
              <Text style={styles.featureText}>{feature.label}</Text>
            </View>
          ))}
        </View>

        {/* Branch Tags */}
        <View style={styles.branchesSection}>
          <Text style={styles.branchesHeader}>Available in 10 branches:</Text>
          <View style={styles.tagsContainer}>
            {BRANCHES.map((b, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{b}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bottom CTA */}
        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.getStartedButton}
            onPress={() => navigation.navigate('Login')}
            activeOpacity={0.8}
          >
            <Text style={styles.getStartedText}>Get Started</Text>
            <Ionicons name="chevron-forward" size={24} color={colors.card} />
          </TouchableOpacity>
          
          <View style={styles.loginRow}>
            <Text style={styles.loginHint}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  heroSection: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.card,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.card,
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    fontWeight: '500',
  },
  heroSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  mainContent: {
    flex: 1,
    paddingTop: 24,
    paddingHorizontal: 20,
    display: 'flex',
    flexDirection: 'column',
  },
  sliderContainer: {
    height: 140,
    marginBottom: 16,
    marginTop: -80, // Negative margin to overlap the hero section
  },
  slide: {
    width: width - 40,
    paddingHorizontal: 4,
  },
  slideCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 20,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 20,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  slideIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  slideTextContainer: {
    flex: 1,
  },
  slideTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  slideDesc: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 28,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    marginHorizontal: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'hsla(224, 82%, 48%, 0.06)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  branchesSection: {
    marginBottom: 28,
  },
  branchesHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'hsla(224, 82%, 48%, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'hsla(224, 82%, 48%, 0.1)',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  footer: {
    marginTop: 'auto',
  },
  getStartedButton: {
    width: '100%',
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 16,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.card,
    marginRight: 8,
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
});

export default OnboardingScreen;