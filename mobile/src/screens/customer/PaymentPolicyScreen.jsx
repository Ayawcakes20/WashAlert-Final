import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import ScrollCue from '../../components/ScrollCue';
import { useScrollCue } from '../../hooks/useScrollCue';

const PaymentPolicyScreen = () => {
  const scrollCue = useScrollCue();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        onScroll={scrollCue.onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={scrollCue.onContentSizeChange}
        onLayout={scrollCue.onLayout}
      >
        <Text style={styles.heading}>Triplets Payment Policy</Text>
        <Text style={styles.subheading}>*For bookings and transactions made through WashAlert</Text>
        <Text style={styles.intro}>
          Please read the following Payment Policy before confirming your booking. By proceeding, you acknowledge and agree to the payment terms below.
        </Text>

        <View style={styles.section}>
          <Text style={styles.title}>1. Payment Requirement</Text>
          <Text style={styles.body}>
            Payment must be completed before the laundry is released or handed over to the customer. The payment process depends on the service and payment method chosen by the customer.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>2. Final Receipt Confirmation</Text>
          <Text style={styles.body}>
            After Triplets receives the laundry at the branch and records the actual weight, the final amount of the order will be calculated based on the applicable service charges. A Final Receipt will then be provided through the WashAlert mobile application. The customer can review the following information:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>•  Actual laundry weight</Text>
            <Text style={styles.bulletItem}>•  Number of loads</Text>
            <Text style={styles.bulletItem}>•  Applicable service charges</Text>
            <Text style={styles.bulletItem}>•  Additional charges, if any</Text>
            <Text style={styles.bulletItem}>•  Total Amount Due</Text>
          </View>
          <Text style={[styles.body, { marginTop: 6 }]}>
            The customer may review and confirm the Final Receipt through the application. The customer will have 60 minutes from the time the Final Receipt is provided to review and confirm the details. If the customer does not confirm the Final Receipt within 60 minutes, the order will automatically proceed to the next processing stage based on the applicable service. Failure to confirm within the 60-minute period will not automatically cancel the order.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>3. Cancellation of Pending Bookings</Text>
          <Text style={styles.body}>
            Cancellation may only be requested while the booking status is Pending and before the laundry has been picked up, received, or processed by Triplets. Once the laundry has been received by the branch, weighed, or processed, cancellation through WashAlert will no longer be available. For concerns regarding the Final Receipt, actual weight, charges, or an order that has already been received or processed, please contact the assigned Triplets branch directly for assistance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>4. Delivery Service</Text>
          <Text style={styles.body}>
            For Delivery Service, Triplets will pick up the customer's laundry from the provided address and deliver it back once the laundry service is completed.
          </Text>
          <Text style={styles.subTitle}>GCash Payment</Text>
          <Text style={styles.body}>
            If the customer chooses GCash Payment, the customer will be directed to the PayMongo payment page after the final amount has been confirmed. Through the PayMongo checkout page, the customer can complete the payment using the available QRPh option by scanning the displayed QR code with GCash. Payment must be successfully completed and confirmed before the completed laundry is released or handed over to the customer.
          </Text>
          <Text style={styles.subTitle}>Cash on Delivery (COD)</Text>
          <Text style={styles.body}>
            If the customer chooses Cash on Delivery (COD), payment will be collected in cash upon delivery. The customer must pay the required amount before the laundry is released or handed over.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>5. Pickup Service</Text>
          <Text style={styles.body}>
            For Pickup Service, the customer brings or drops off the laundry at the selected Triplets branch and returns to collect it once it is ready.
          </Text>
          <Text style={[styles.body, { marginTop: 4 }]}>
            Triplets accepts the following payment methods at the branch:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>•  GCash</Text>
            <Text style={styles.bulletItem}>•  Cash</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>6. Final Amount and Additional Charges</Text>
          <Text style={styles.body}>
            The final amount may vary depending on the actual laundry weight, selected service, and applicable additional charges.
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bulletItem}>•  Weight Limit: The standard load is up to 8 kg, depending on the applicable service. If the applicable load limit is exceeded, an additional ₱50 charge may apply or the laundry may be counted as an additional load, depending on the service.</Text>
            <Text style={styles.bulletItem}>•  Rush Service: A ₱150 priority fee per load applies to rush service requests.</Text>
          </View>
          <Text style={[styles.body, { marginTop: 6 }]}>
            These are service-related additional charges and are not general penalties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>7. Unclaimed Laundry</Text>
          <Text style={styles.body}>
            Laundry that remains unclaimed for 15 days may be charged at double the applicable amount or may be subject to forfeiture and disposal by Triplets to recover expenses.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>8. Payment Confirmation</Text>
          <Text style={styles.body}>
            For payments made through WashAlert, the payment status will be updated after the payment has been successfully completed and confirmed through the available payment service. An order will not be considered paid if the payment is unsuccessful or has not been confirmed.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.title}>9. Payment and Order Concerns</Text>
          <Text style={styles.body}>
            For concerns regarding payment, the Final Receipt, actual laundry weight, additional charges, cancellation, or an order that has already been received or processed, customers may contact the assigned Triplets branch directly for assistance.
          </Text>
        </View>

        <Text style={styles.footer}>Policy confirmed directly with Triplets LaundryHubs — last updated September 2026.</Text>
      </ScrollView>
      <ScrollCue visible={scrollCue.showCue} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.text },
  subheading: { fontSize: 13, fontWeight: '700', color: colors.primary, marginTop: -8 },
  intro: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: -2 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  subTitle: { fontSize: 13, fontWeight: '700', color: colors.text, marginTop: 6 },
  body: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  bulletList: { marginTop: 4, gap: 3, paddingLeft: 4 },
  bulletItem: { fontSize: 12, lineHeight: 18, color: colors.textSecondary },
  footer: { marginTop: 4, fontSize: 11, color: colors.textTertiary },
});

export default PaymentPolicyScreen;
