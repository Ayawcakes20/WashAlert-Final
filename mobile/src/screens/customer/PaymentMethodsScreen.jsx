import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const PaymentMethodsScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Payment methods currently available in WashAlert booking flow.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="card-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>GCash / QRPh</Text>
              <Text style={styles.desc}>Pay via GCash QR code once the branch confirms your final price.</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="cash-outline" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Cash on Delivery / Pickup</Text>
              <Text style={styles.desc}>Pay in cash when your laundry is delivered, or at the branch counter.</Text>
            </View>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            You can choose your payment option during checkout for every order. Payment is required before your laundry is delivered or released for pickup — no branch visit needed for pickup and delivery orders.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Additional Charges</Text>
          <Text style={[styles.desc, { marginTop: 6 }]}>
            • Orders exceeding the standard load limit (8kg, up to 9kg depending on service) are charged an additional ₱60, or split into 2 loads.
          </Text>
          <Text style={styles.desc}>
            • Rush orders carry a priority fee of +₱150 per load.
          </Text>
          <Text style={[styles.desc, { marginTop: 6 }]}>
            No cancellation or no-show penalty is charged beyond the above.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.policyLink}
          onPress={() => navigation.navigate('PaymentPolicy')}
          activeOpacity={0.7}
        >
          <Text style={styles.policyLinkText}>View Full Payment Policy</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  title: { fontSize: 14, fontWeight: '700', color: colors.text },
  desc: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },
  noteCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  noteText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
  },
  policyLinkText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});

export default PaymentMethodsScreen;
