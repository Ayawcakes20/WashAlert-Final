import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

const TermsAndConditionsScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>WashAlert Terms & Conditions</Text>

        <View style={styles.section}>
          <Text style={styles.title}>1. Service Scope</Text>
          <Text style={styles.body}>
            WashAlert coordinates laundry booking, pickup, washing, delivery updates, and payment tracking through partner branches.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>2. Booking Responsibility</Text>
          <Text style={styles.body}>
            Customers must provide accurate pickup, delivery, and contact details. Incorrect details may delay or prevent service completion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>3. Payments</Text>
          <Text style={styles.body}>
            Payment options may include GCash and cash on pickup. Orders requiring online payment are only considered paid after successful confirmation.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>4. Delivery and Timing</Text>
          <Text style={styles.body}>
            Time estimates are best-effort and may vary due to traffic, weather, branch load, and operations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>5. Account Use</Text>
          <Text style={styles.body}>
            Users are responsible for account security and should not share credentials. Suspicious account activity should be reported promptly.
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

export default TermsAndConditionsScreen;
