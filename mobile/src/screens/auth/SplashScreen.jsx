import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WashingMachineLoader } from '../../components';

const SplashScreen = () => {
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.inner}>
        <View style={styles.centerContent}>

          {/* App icon */}
          <View style={styles.iconShadow}>
            <Image
              source={require('../../../assets/images/icon.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>

          {/* Brand name */}
          <Text style={styles.brand}>WashAlert</Text>
          <Text style={styles.tagline}>Smart Laundry, Fast Service</Text>

          {/* Loader */}
          <View style={styles.loaderWrap}>
            <WashingMachineLoader size={44} />
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>by Triplets LaundryHubs & SpeedyWash</Text>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#1A2B4A',
  },
  inner: { flex: 1, alignItems: 'center' },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconShadow: {
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 12,
    marginBottom: 10,
  },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 26,
  },
  brand: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginTop: 4,
  },
  tagline: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    letterSpacing: 0.3,
    marginBottom: 40,
  },
  loaderWrap: { opacity: 0.75 },
  footer: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 0.3,
    marginBottom: 28,
  },
});

export default SplashScreen;
