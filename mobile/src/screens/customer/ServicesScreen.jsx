import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

const LAUNDRY_SERVICES = [
  {
    id: 'wash',
    name: 'Wash',
    icon: 'washing-machine',
    price: '₱80 / 7kg',
    tag: 'Standard',
    tagColor: '#2E86C1',
    tagBg: '#D6EAF8',
    description: 'Full machine wash cycle using water and detergent.',
    inclusions: [
      'Machine wash cycle',
      'Folding',
      'Detergent — 1 pack (optional add-on)',
      'Fabric conditioner — 1 pack (optional add-on)',
    ],
    note: 'Price is per load. Final load count confirmed after weighing at branch.',
  },
  {
    id: 'dry',
    name: 'Dry',
    icon: 'tumble-dryer',
    price: '₱90 / 7kg',
    tag: 'Standard',
    tagColor: '#E11D48',
    tagBg: '#FFF1F2',
    description: 'Machine drying only — no washing included.',
    inclusions: [
      'Machine dry cycle',
      'Folding',
      'No detergent or fabric conditioner needed',
    ],
    note: 'Best for items that are already washed or lightly used.',
  },
  {
    id: 'ecowash',
    name: 'Ecowash Full',
    icon: 'leaf',
    price: '₱220 / 5kg',
    tag: 'Eco',
    tagColor: '#059669',
    tagBg: '#D1FAE5',
    description: 'Eco-friendly wash and dry using less water and energy.',
    inclusions: [
      'Eco wash cycle',
      'Machine dry',
      'Folding',
      'Detergent — 1 pack (optional add-on)',
      'Fabric conditioner — not included (bring your own or skip)',
    ],
    note: 'Great for everyday clothes and delicates.',
  },
  {
    id: 'basic',
    name: 'Basic Full Service',
    icon: 'washing-machine',
    price: '₱245 / 8kg',
    tag: '',
    tagColor: 'transparent',
    tagBg: 'transparent',
    description: 'Complete wash and dry service at an affordable rate.',
    inclusions: [
      'Machine wash',
      'Machine dry',
      'Folding',
      'Detergent — 1 pack (optional add-on)',
      'Fabric conditioner — 1 pack (optional add-on)',
    ],
    note: 'Best value for regular household laundry.',
  },
  {
    id: 'premium',
    name: 'Premium Full Service',
    icon: 'star-four-points-outline',
    price: '₱275 / 8kg',
    tag: 'Premium',
    tagColor: '#7C3AED',
    tagBg: '#EDE9FE',
    description: 'Our top-tier service with premium detergents and priority handling.',
    inclusions: [
      'Machine wash',
      'Machine dry',
      'Folding',
      'Premium detergent — 1 pack (included in price)',
      'Fabric conditioner — 1 pack (included in price)',
      'Priority processing',
    ],
    note: 'Ideal for work clothes, uniforms, and items needing special care.',
  },
  {
    id: 'handwash',
    name: 'Handwash',
    icon: 'hand-wash',
    price: '₱150/kg (≤3kg) · ₱90/kg (>3kg)',
    tag: 'Hand',
    tagColor: '#1C2F3E',
    tagBg: '#E8EFF4',
    description: 'Gentle hand washing for delicate fabrics and special items.',
    inclusions: [
      'Hand wash (gentle on delicates)',
      'Air dry recommended',
      'Folding',
      'Detergent — 1 pack (optional add-on)',
      'Fabric conditioner — not recommended for delicates',
    ],
    note: 'Recommended for lingerie, silk, linen, and other delicates.',
  },
];

export default function ServicesScreen({ navigation }) {
  const [expanded, setExpanded] = useState(null);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Laundry Services</Text>
          <Text style={styles.headerSub}>Tap a package to see what is included</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {LAUNDRY_SERVICES.map((svc) => {
          const isOpen = expanded === svc.id;
          return (
            <TouchableOpacity
              key={svc.id}
              style={[styles.card, isOpen && styles.cardOpen]}
              onPress={() => setExpanded(isOpen ? null : svc.id)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View style={[styles.iconBox, isOpen && styles.iconBoxActive]}>
                  <MaterialCommunityIcons
                    name={svc.icon}
                    size={22}
                    color={isOpen ? '#fff' : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameLine}>
                    <Text style={[styles.svcName, isOpen && styles.svcNameActive]}>{svc.name}</Text>
                    {!!svc.tag && (
                      <View style={[styles.tag, { backgroundColor: svc.tagBg }]}>
                        <Text style={[styles.tagTxt, { color: svc.tagColor }]}>{svc.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.price}>{svc.price}</Text>
                </View>
                <View style={styles.detailsToggle}>
                  <Text style={[styles.detailsTxt, isOpen && styles.detailsTxtActive]}>
                    {isOpen ? 'Hide' : 'Details'}
                  </Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={14}
                    color={isOpen ? colors.primary : colors.textTertiary}
                  />
                </View>
              </View>

              {isOpen && (
                <View style={styles.details}>
                  <Text style={styles.description}>{svc.description}</Text>

                  <Text style={styles.inclLabel}>{"WHAT'S INCLUDED"}</Text>
                  {svc.inclusions.map((item, i) => (
                    <View key={i} style={styles.inclRow}>
                      <Ionicons name="checkmark-circle" size={15} color="#16A34A" />
                      <Text style={styles.inclText}>{item}</Text>
                    </View>
                  ))}

                  {!!svc.note && (
                    <View style={styles.note}>
                      <Ionicons name="information-circle-outline" size={14} color="#2563EB" />
                      <Text style={styles.noteTxt}>{svc.note}</Text>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            All prices are estimates. Final price is confirmed after weighing at the branch.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.stickyFooter}>
        <TouchableOpacity
          style={styles.bookBtn}
          onPress={() => navigation.navigate('Book')}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="washing-machine" size={18} color="#fff" />
          <Text style={styles.bookBtnTxt}>Book Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 13, color: colors.textSecondary, marginTop: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 16 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardOpen: {
    borderColor: colors.primary,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxActive: { backgroundColor: colors.primary },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  svcName: { fontSize: 15, fontWeight: '700', color: colors.text },
  svcNameActive: { color: colors.primary },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
  },
  tagTxt: { fontSize: 10, fontWeight: '700' },
  price: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailsTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  detailsTxtActive: {
    color: colors.primary,
  },
  details: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: 12,
    marginBottom: 14,
  },
  inclLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#166534',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inclRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  inclText: { fontSize: 13, color: '#166534', flex: 1, lineHeight: 18 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    padding: 10,
  },
  noteTxt: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 18 },
  footerNote: { marginTop: 4, marginBottom: 8 },
  footerText: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', lineHeight: 18 },
  stickyFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  bookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  bookBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
