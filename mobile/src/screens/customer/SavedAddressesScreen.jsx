import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const STORAGE_KEY = 'washalert_saved_addresses_v1';

const SavedAddressesScreen = () => {
  const [items, setItems] = useState([]);
  const [label, setLabel] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        setItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setItems([]);
      }
    };
    void load();
  }, []);

  const persist = async (next) => {
    setItems(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const addAddress = async () => {
    if (!label.trim() || !address.trim()) {
      Alert.alert('Incomplete', 'Please provide both label and address.');
      return;
    }
    const next = [
      ...items,
      { id: `${Date.now()}`, label: label.trim(), address: address.trim() },
    ];
    await persist(next);
    setLabel('');
    setAddress('');
  };

  const removeAddress = async (id) => {
    const next = items.filter((item) => item.id !== id);
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
                <Text style={styles.addressLabel}>{item.label}</Text>
                <Text style={styles.addressValue}>{item.address}</Text>
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
});

export default SavedAddressesScreen;
