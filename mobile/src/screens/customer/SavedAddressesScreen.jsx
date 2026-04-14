import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import {
  loadSavedAddresses,
  saveSavedAddresses,
} from '../../services/savedAddresses';

const SavedAddressesScreen = () => {
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const parsed = await loadSavedAddresses();
        setItems(parsed);
      } catch {
        setItems([]);
      }
    };
    void load();
  }, []);

  const persist = async (next) => {
    const saved = await saveSavedAddresses(next);
    setItems(saved);
  };

  const addAddress = async () => {
    if (!label.trim() || !address.trim()) {
      Alert.alert('Incomplete', 'Please provide both label and address.');
      return;
    }
    const next = [
      ...items,
      {
        id: `${Date.now()}`,
        label: label.trim(),
        address: address.trim(),
        isDefault: items.length === 0,
      },
    ];
    await persist(next);
    setLabel('');
    setAddress('');
  };

  const removeAddress = async (id) => {
    const next = items.filter((item) => item.id !== id);
    await persist(next);
  };

  const setDefaultAddress = async (id) => {
    const next = items.map((item) => ({
      ...item,
      isDefault: item.id === id,
    }));
    await persist(next);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>Saved addresses can be reused for delivery bookings.</Text>

        <View style={styles.formCard}>
          <TextInput
            placeholder="Label (e.g. Home, Office)"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            value={label}
            onChangeText={setLabel}
          />
          <TextInput
            placeholder="Full address"
            placeholderTextColor={colors.textTertiary}
            style={[styles.input, styles.multi]}
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <TouchableOpacity style={styles.addButton} onPress={addAddress}>
            <Text style={styles.addButtonText}>Save Address</Text>
          </TouchableOpacity>
        </View>

        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={styles.addressCard}>
              <View style={{ flex: 1 }}>
                <View style={styles.labelRow}>
                  <Text style={styles.addressLabel}>{item.label}</Text>
                  {item.isDefault ? <Text style={styles.defaultBadge}>Default</Text> : null}
                </View>
                <Text style={styles.addressValue}>{item.address}</Text>
                {!item.isDefault ? (
                  <TouchableOpacity onPress={() => setDefaultAddress(item.id)} style={styles.defaultBtn}>
                    <Text style={styles.defaultBtnText}>Set as Default</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <TouchableOpacity onPress={() => removeAddress(item.id)}>
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  hint: { fontSize: 13, color: colors.textSecondary },
  formCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    height: 44,
    paddingHorizontal: 12,
    color: colors.text,
  },
  multi: { minHeight: 70, textAlignVertical: 'top', paddingTop: 10 },
  addButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: colors.card, fontWeight: '700', fontSize: 13 },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    backgroundColor: colors.card,
  },
  emptyText: { fontSize: 13, color: colors.textSecondary },
  addressCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    backgroundColor: colors.card,
  },
  addressLabel: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 4 },
  addressValue: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  defaultBadge: {
    fontSize: 10,
    color: colors.success,
    backgroundColor: 'rgba(22, 163, 74, 0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontWeight: '700',
  },
  defaultBtn: { marginTop: 10, alignSelf: 'flex-start' },
  defaultBtnText: { fontSize: 11, fontWeight: '700', color: colors.primary },
});

export default SavedAddressesScreen;
