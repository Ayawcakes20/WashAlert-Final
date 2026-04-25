import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import {
  loadSavedAddresses,
  saveSavedAddresses,
} from '../../services/savedAddresses';
import AddressPickerSheet from '../../components/AddressPickerSheet';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LABEL_ICONS = {
  Home:   { name: 'home-outline',      color: '#2EC4B6' },
  Office: { name: 'briefcase-outline', color: '#3B82F6' },
  Other:  { name: 'location-outline',  color: '#F4A72A' },
};

const getLabelIcon = (label = '') => {
  const key = Object.keys(LABEL_ICONS).find((k) =>
    String(label).toLowerCase().includes(k.toLowerCase())
  );
  return LABEL_ICONS[key] || LABEL_ICONS.Other;
};

// ─── Component ────────────────────────────────────────────────────────────────

const SavedAddressesScreen = () => {
  const [items, setItems] = useState([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // null = adding new

  // ── Load ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadSavedAddresses().then(setItems).catch(() => setItems([]));
  }, []);

  const persist = async (next) => {
    const saved = await saveSavedAddresses(next);
    setItems(saved);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────
  const handleAddNew = () => {
    setEditingItem(null);
    setPickerVisible(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setPickerVisible(true);
  };

  const handlePickerConfirm = async (addrObj) => {
    setPickerVisible(false);

    if (editingItem) {
      // Update existing entry
      const next = items.map((item) =>
        item.id === editingItem.id
          ? {
              ...item,
              address: addrObj.address,
              unitFloor: addrObj.unitFloor || '',
              contactName: addrObj.contactName || '',
              phone: addrObj.phone || '',
              latitude: addrObj.latitude || null,
              longitude: addrObj.longitude || null,
              label: addrObj.label || item.label,
            }
          : item
      );
      await persist(next);
    } else {
      // Add new entry
      const newEntry = {
        id: String(Date.now()),
        label: addrObj.label || 'Other',
        address: addrObj.address,
        unitFloor: addrObj.unitFloor || '',
        contactName: addrObj.contactName || '',
        phone: addrObj.phone || '',
        latitude: addrObj.latitude || null,
        longitude: addrObj.longitude || null,
        isDefault: items.length === 0,
      };
      await persist([...items, newEntry]);
    }
    setEditingItem(null);
  };

  const removeAddress = async (id) => {
    Alert.alert('Remove Address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => await persist(items.filter((i) => i.id !== id)),
      },
    ]);
  };

  const setDefaultAddress = async (id) => {
    await persist(items.map((item) => ({ ...item, isDefault: item.id === id })));
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Address Picker Modal */}
      <AddressPickerSheet
        visible={pickerVisible}
        title={editingItem ? 'Edit Address' : 'Add New Address'}
        onConfirm={handlePickerConfirm}
        onClose={() => { setPickerVisible(false); setEditingItem(null); }}
        initialValue={editingItem}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Save addresses for quick booking — pick from your list without retyping every time.
        </Text>

        {/* Empty state */}
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="location-outline" size={32} color={colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>No saved addresses yet</Text>
            <Text style={styles.emptyText}>
              Add your home, office, or other frequent addresses to speed up future bookings.
            </Text>
          </View>
        ) : (
          items.map((item) => {
            const iconCfg = getLabelIcon(item.label);
            return (
              <View key={item.id} style={[styles.addressCard, item.isDefault && styles.addressCardDefault]}>
                {/* Card header: icon + label + actions */}
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: iconCfg.color + '20' }]}>
                    <Ionicons name={iconCfg.name} size={18} color={iconCfg.color} />
                  </View>
                  <View style={styles.labelRow}>
                    <Text style={styles.addressLabel}>{item.label}</Text>
                    {item.isDefault && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.cardActions}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
                      <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeAddress(item.id)} style={styles.actionBtn}>
                      <Ionicons name="trash-outline" size={16} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Address content */}
                <Text style={styles.addressValue}>{item.address}</Text>
                {item.unitFloor ? <Text style={styles.addressSub}>{item.unitFloor}</Text> : null}
                {item.contactName ? (
                  <Text style={styles.addressSub}>
                    {item.contactName}{item.phone ? `  ·  ${item.phone}` : ''}
                  </Text>
                ) : null}

                {/* Set default CTA */}
                {!item.isDefault && (
                  <TouchableOpacity onPress={() => setDefaultAddress(item.id)} style={styles.setDefaultBtn}>
                    <Ionicons name="star-outline" size={13} color={colors.primary} />
                    <Text style={styles.setDefaultText}>Set as Default</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}

        {/* Spacer for FAB */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity style={styles.fab} onPress={handleAddNew} activeOpacity={0.85}>
        <Ionicons name="add" size={22} color="#FFF" />
        <Text style={styles.fabText}>Add Address</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120, gap: 14 },
  hint: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Empty state
  emptyCard: {
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    padding: 32, backgroundColor: colors.surface,
    alignItems: 'center', gap: 10, marginTop: 8,
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },

  // Address card
  addressCard: {
    borderRadius: 16, borderWidth: 1.5, borderColor: colors.border,
    padding: 16, backgroundColor: colors.surface, gap: 6,
  },
  addressCardDefault: {
    borderColor: colors.primary + '60',
    backgroundColor: colors.primaryLight,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  labelRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressLabel: { fontSize: 14, fontWeight: '700', color: colors.text },
  defaultBadge: {
    backgroundColor: colors.successLight, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  defaultBadgeText: { fontSize: 9, fontWeight: '700', color: colors.success },
  cardActions: { flexDirection: 'row', gap: 6 },
  actionBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center', justifyContent: 'center',
  },
  addressValue: { fontSize: 13, color: colors.text, lineHeight: 18 },
  addressSub: { fontSize: 12, color: colors.textSecondary },
  setDefaultBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', marginTop: 4,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: colors.background,
  },
  setDefaultText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  // FAB
  fab: {
    position: 'absolute', bottom: 28, left: 20, right: 20,
    height: 54, borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  fabText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});

export default SavedAddressesScreen;
