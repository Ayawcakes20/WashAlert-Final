import React, { useEffect, useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet } from 'react-native';




import { useAuth } from '../../context/AuthContext';
import {colors} from '../../theme/colors';
import { typography } from '../../theme/typography';
import { WashingMachineLoader } from '../../components';

const SplashScreen = ({ navigation }) => {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      // For now, always go to onboarding to test the full flow
      navigation?.navigate('Onboarding');
    }, 3000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.role, navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>WashAlert</Text>
        <WashingMachineLoader size={100} />
        <Text style={styles.tagline}>Smart Laundry, Fast Service</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  logo: {
    fontSize: typography.h1.fontSize,
    fontWeight: typography.h1.fontWeight,
    color: colors.primary,
    marginBottom: 40,
  },
  tagline: {
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
    marginTop: 24,
    textAlign: 'center',
  },
});

export default SplashScreen;