import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

const PrivacyPolicyScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>WashAlert Privacy Policy</Text>

        <View style={styles.section}>
          <Text style={styles.title}>1. Data We Collect</Text>
          <Text style={styles.body}>
            We collect account details, booking and order data, delivery addresses, payment status data, and app/device notification tokens needed for service operations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>2. How Data Is Used</Text>
          <Text style={styles.body}>
            Data is used to process bookings, provide status notifications, support deliveries, verify payments, and improve platform reliability.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>3. Location and Delivery Data</Text>
          <Text style={styles.body}>
            Delivery location details are used only for pickup/drop-off coordination, route progress, and delivery completion events.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>4. Security</Text>
          <Text style={styles.body}>
            WashAlert applies access controls and server-side secret management. Sensitive keys are not exposed in client code.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>5. Contact and Support</Text>
          <Text style={styles.body}>
            For account, correction, or deletion requests, contact WashAlert support through the in-app support channel.
          </Text>
        </View>

        <Text style={styles.footer}>Last updated: April 13, 2026</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  body: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  footer: { marginTop: 4, fontSize: 11, color: colors.textTertiary },
});

export default PrivacyPolicyScreen;
