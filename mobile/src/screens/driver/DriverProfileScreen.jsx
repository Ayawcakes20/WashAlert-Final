import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { deliveries as deliveriesApi } from '../../services/api';

const MENU_GROUPS = [
  {
    title: 'Earnings',
    items: [
      { label: 'Earnings History', icon: 'cash-outline', color: colors.success },
      { label: 'This Month', icon: 'calendar-outline', color: colors.primary },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Change Password', icon: 'lock-closed-outline', color: colors.primary, screen: 'ChangePassword' },
      { label: 'Notification Settings', icon: 'notifications-outline', color: colors.warning, screen: 'DriverNotifications' },
      { label: 'Terms & Conditions', icon: 'document-text-outline', color: colors.textSecondary, screen: 'TermsAndConditions' },
      { label: 'Privacy Policy', icon: 'shield-checkmark-outline', color: colors.textSecondary, screen: 'PrivacyPolicy' },
      { label: 'Help & Support', icon: 'help-circle-outline', color: colors.accent, screen: 'Chat' },
    ],
  },
];

const ZERO_STATS = {
  totalEarnings: 0,
  monthEarnings: 0,
  totalDeliveries: 0,
  monthDeliveries: 0,
  rating: null,
};

const DriverProfileScreen = ({ navigation }) => {
  const { user, logout } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'Driver';
  const [stats, setStats] = useState(ZERO_STATS);

  const loadStats = useCallback(async () => {
    try {
      const response = await deliveriesApi.getMy('all');
      const rows = Array.isArray(response?.deliveries) ? response.deliveries : [];
      const now = new Date();
      const monthDeliveries = rows.filter((delivery) => {
        const stamp = delivery?.updatedAt || delivery?.estimatedDelivery;
        if (!stamp) return false;
        const parsed = new Date(stamp);
        if (Number.isNaN(parsed.getTime())) return false;
        return parsed.getMonth() === now.getMonth() && parsed.getFullYear() === now.getFullYear();
      }).length;

      setStats({
        totalEarnings: 0,
        monthEarnings: 0,
        totalDeliveries: rows.length,
        monthDeliveries,
        rating: null,
      });
    } catch (error) {
      console.warn('[DriverProfile] Unable to load stats, using zero state.', error?.message || error);
      setStats(ZERO_STATS);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      void loadStats();
    });
    void loadStats();
    return unsubscribe;
  }, [loadStats, navigation]);

  const ratingText = stats.rating == null ? 'N/A' : String(stats.rating);
  const statsTiles = useMemo(() => ([
    { label: 'Total Deliveries', value: String(stats.totalDeliveries), icon: 'cube-outline', color: colors.primary },
    { label: 'Rating', value: ratingText, icon: 'star-outline', color: colors.warning },
    { label: 'This Month', value: String(stats.monthDeliveries), icon: 'trending-up-outline', color: colors.success },
  ]), [ratingText, stats.monthDeliveries, stats.totalDeliveries]);

  const formatPeso = (amount) =>
    `₱${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.container}
      >
        <Text style={styles.pageTitle}>Profile</Text>

        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarInitial}>{firstName.charAt(0)}</Text>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.fullName}>{user?.fullName || 'Driver'}</Text>
            <Text style={styles.email}>{user?.email || '-'}</Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={13} color={colors.warning} />
              <Text style={styles.ratingVal}>{ratingText}</Text>
              <Text style={styles.deliveriesCount}>· {stats.totalDeliveries} deliveries</Text>
            </View>
          </View>
        </View>

        <View style={styles.earningsBlock}>
          <View>
            <Text style={styles.earningsLabel}>TOTAL EARNINGS</Text>
            <Text style={styles.earningsValue}>{formatPeso(stats.totalEarnings)}</Text>
            <Text style={styles.earningsSub}>This month: {formatPeso(stats.monthEarnings)}</Text>
          </View>
          <View style={styles.earningsIcon}>
            <MaterialCommunityIcons name="wallet-outline" size={28} color={colors.primary} />
          </View>
        </View>

        <View style={styles.statsRow}>
          {statsTiles.map((item) => (
            <View key={item.label} style={styles.statTile}>
              <View style={[styles.statIconBox, { backgroundColor: `${item.color}15` }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {MENU_GROUPS.map((group) => (
          <View key={group.title} style={styles.menuGroup}>
            <Text style={styles.groupLabel}>{group.title}</Text>
            <View style={styles.menuCard}>
              {group.items.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.menuRow, i < group.items.length - 1 && styles.menuRowBorder]}
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.screen) {
                      navigation.navigate(item.screen);
                      return;
                    }
                    Alert.alert('Coming Soon', `${item.label} is not yet available in this build.`);
                  }}
                >
                  <View style={[styles.menuIconBox, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={18} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={19} color={colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 20 },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  avatarInitial: { fontSize: 26, fontWeight: '800', color: colors.primary },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  identityInfo: { flex: 1 },
  fullName: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 2 },
  email: { fontSize: 13, color: colors.textSecondary, marginBottom: 6 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingVal: { fontSize: 13, fontWeight: '700', color: colors.text },
  deliveriesCount: { fontSize: 12, color: colors.textTertiary },
  earningsBlock: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  earningsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  earningsValue: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', marginBottom: 2 },
  earningsSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  earningsIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text },
  statLabel: { fontSize: 9, fontWeight: '600', color: colors.textTertiary, textAlign: 'center', letterSpacing: 0.2 },
  menuGroup: { marginBottom: 20 },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  menuIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: `${colors.error}25`,
    gap: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: colors.error },
});

export default DriverProfileScreen;
