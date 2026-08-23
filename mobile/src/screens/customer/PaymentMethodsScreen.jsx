import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const PaymentMethodsScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>Payment methods currently available in WashAlert booking flow.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="card-outline" size={20} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>GCash / QRPh</Text>
              <Text style={styles.desc}>Scan QRPh / GCash QR code and upload payment receipt.</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Ionicons name="cash-outline" size={20} color={colors.success} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Cash on Pickup</Text>
              <Text style={styles.desc}>Pay directly at the branch counter.</Text>
            </View>
          </View>
        </View>

        <View style={styles.noteCard}>
          <Text style={styles.noteText}>
            You can choose your payment option during checkout for every order.
          </Text>
        </View>
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
});

export default PaymentMethodsScreen;
