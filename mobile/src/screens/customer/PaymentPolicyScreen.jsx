import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

const PaymentPolicyScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>WashAlert Payment Policy</Text>
        <Text style={styles.intro}>
          This policy applies to all orders placed through Triplets LaundryHubs and SpeedyWash, for both branch pickup and pickup-and-delivery orders.
        </Text>

        <View style={styles.section}>
          <Text style={styles.title}>1. When Payment Is Required</Text>
          <Text style={styles.body}>
            Payment must be settled before your laundry is delivered or released for pickup. You do not need to visit the branch to pay — for pickup and delivery orders, payment is made via Cash on Delivery or GCash/Maya before your laundry arrives.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>2. Accepted Payment Methods</Text>
          <Text style={styles.body}>
            WashAlert currently processes Cash on Delivery/Pickup and GCash through the app. Other methods offered directly by the branch (such as Maya, GoTyme, or BPI) are not yet processed through the app and should be arranged with branch staff directly.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>3. Load Weight Limit</Text>
          <Text style={styles.body}>
            Standard load capacity is up to 8kg (up to 9kg depending on the service). Orders that exceed this limit are charged an additional ₱60, or split into 2 loads, once the branch weighs your laundry.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>4. Rush Service Fee</Text>
          <Text style={styles.body}>
            A priority fee of +₱150 per load applies to orders marked as Rush during booking.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>5. Cancellations and No Penalties</Text>
          <Text style={styles.body}>
            Triplets LaundryHubs and SpeedyWash do not charge a cancellation or no-show penalty. The only additional charges are the weight-limit and rush-service fees above.
          </Text>
        </View>

        <Text style={styles.footer}>Policy confirmed directly with Triplets LaundryHubs — last updated September 2026.</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text },
  intro: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: -6 },
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

export default PaymentPolicyScreen;
