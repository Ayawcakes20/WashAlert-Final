import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi } from '../../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const calcDaysRemaining = (stock, avgDailyUsage) => {
  if (!avgDailyUsage || avgDailyUsage < 0.001) return null;
  return Math.floor(stock / avgDailyUsage);
};

const getStatus = (currentStock, reorderLevel, stockAfter7) => {
  if (currentStock <= reorderLevel || stockAfter7 < 0) return 'Critical';
  if (currentStock <= reorderLevel * 1.5) return 'Low Stock';
  return 'Healthy';
};

const STATUS_STYLE = {
  Critical:   { bg: colors.errorLight,   text: colors.error,   label: 'Critical' },
  'Low Stock': { bg: colors.warningLight, text: colors.warning, label: 'Low Stock' },
  Healthy:    { bg: colors.successLight, text: colors.success, label: 'Healthy' },
};

const ITEMS_PER_PAGE = 5;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <MaterialCommunityIcons name={icon} size={20} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InventoryItemCard({ item }) {
  const avgUsage = item.estimatedDailyUsage ?? 0;
  const estUse7 = +(avgUsage * 7).toFixed(1);
  const stockAfter7 = +(item.currentStock - estUse7).toFixed(1);
  const status = getStatus(item.currentStock, item.reorderLevel, stockAfter7);
  const daysLeft = calcDaysRemaining(item.currentStock, avgUsage);
  const st = STATUS_STYLE[status];

  const stockPct = item.reorderLevel > 0
    ? Math.min(100, Math.round((item.currentStock / (item.reorderLevel * 3)) * 100))
    : 50;

  const barColor =
    status === 'Critical' ? colors.error :
    status === 'Low Stock' ? colors.warning :
    colors.success;

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemCardHeader}>
        <View style={styles.itemCardLeft}>
          <MaterialCommunityIcons name="package-variant" size={18} color={colors.accent} />
          <View style={styles.itemCardTitles}>
            <Text style={styles.itemName}>{item.itemName}</Text>
            <Text style={styles.itemBranch}>{item.branch} · {item.category}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      {/* Stock bar */}
      <View style={styles.stockRow}>
        <Text style={styles.stockLabel}>Current Stock</Text>
        <Text style={styles.stockValue}>
          {item.currentStock} {item.unit}
        </Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${stockPct}%`, backgroundColor: barColor }]} />
      </View>

      <View style={styles.itemDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Est. Use 7D</Text>
          <Text style={styles.detailValue}>{estUse7} {item.unit}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>After 7 Days</Text>
          <Text style={[styles.detailValue, stockAfter7 < 0 && styles.negativeValue]}>
            {stockAfter7 < 0 && '⚠ '}{stockAfter7} {item.unit}
          </Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Reorder At</Text>
          <Text style={styles.detailValue}>{item.reorderLevel} {item.unit}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Days Left</Text>
          <Text style={[styles.detailValue, status === 'Critical' && styles.criticalValue]}>
            {daysLeft !== null ? `~${daysLeft} days` : 'No data'}
          </Text>
        </View>
      </View>
    </View>
  );
}

function NarrativeCard({ item }) {
  const avgUsage = item.estimatedDailyUsage ?? 0;
  const daysLeft = calcDaysRemaining(item.currentStock, avgUsage);
  const estUse7 = +(avgUsage * 7).toFixed(1);
  const stockAfter7 = +(item.currentStock - estUse7).toFixed(1);
  const status = getStatus(item.currentStock, item.reorderLevel, stockAfter7);

  const isCritical = status === 'Critical' || (daysLeft !== null && daysLeft <= 7);
  const isMonitor = !isCritical && daysLeft !== null && daysLeft <= 30;

  const accentColor = isCritical ? colors.error : isMonitor ? colors.warning : colors.success;
  const bgColor = isCritical ? colors.errorLight : isMonitor ? colors.warningLight : colors.successLight;

  let subtitle, narrative;
  if (item.currentStock <= item.reorderLevel) {
    subtitle = 'Reorder immediately';
    narrative = `Current stock is ${item.currentStock} ${item.unit}. Your reorder level is ${item.reorderLevel} ${item.unit}. Stock has ALREADY reached the reorder level. Recommended immediate restock.`;
  } else if (daysLeft === null || avgUsage < 0.001) {
    subtitle = 'No action needed';
    narrative = `Current stock is ${item.currentStock} ${item.unit}. No recent usage data available — monitor manually.`;
  } else if (daysLeft <= 14) {
    subtitle = 'Plan restock within 2 weeks';
    narrative = `Current stock is ${item.currentStock} ${item.unit}. At ${avgUsage.toFixed(1)} ${item.unit}/day, stock will last ~${daysLeft} more days before reaching the reorder level.`;
  } else {
    subtitle = 'No action needed';
    narrative = `Current stock is ${item.currentStock} ${item.unit}. At ${avgUsage.toFixed(1)} ${item.unit}/day, stock will last ~${daysLeft} days — well above the reorder level.`;
  }

  return (
    <View style={[styles.narrativeCard, { borderLeftColor: accentColor, backgroundColor: bgColor }]}>
      <View style={styles.narrativeHeader}>
        <View style={[styles.narrativeDot, { backgroundColor: accentColor }]} />
        <View style={styles.narrativeTitles}>
          <Text style={[styles.narrativeTitle, { color: accentColor }]}>{item.itemName} — {item.branch}</Text>
          <Text style={[styles.narrativeSubtitle, { color: accentColor }]}>{subtitle}</Text>
        </View>
      </View>
      <Text style={styles.narrativeText}>{narrative}</Text>
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function StaffInventoryScreen() {
  const { user } = useAuth();
  const branch = user?.branch || '';

  const [inventory, setInventory] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [forecastPage, setForecastPage] = useState(1);
  const [narrativePage, setNarrativePage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [inv, fc] = await Promise.all([
        inventoryApi.list(branch),
        inventoryApi.forecast(30, branch),
      ]);
      setInventory(Array.isArray(inv) ? inv : []);
      setForecast(Array.isArray(fc) ? fc : []);
    } catch (_err) {
      setError('Unable to load inventory. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Merge forecast data into inventory
  const enriched = inventory.map((item) => {
    const fc = forecast.find(
      (f) => f.itemName === item.itemName && f.branch === item.branch,
    );
    return { ...item, estimatedDailyUsage: fc?.estimatedDailyUsage ?? 0 };
  });

  const criticalItems = enriched.filter((i) => {
    const estUse7 = +(( i.estimatedDailyUsage ?? 0) * 7).toFixed(1);
    const after7 = +(i.currentStock - estUse7).toFixed(1);
    return getStatus(i.currentStock, i.reorderLevel, after7) === 'Critical';
  });

  // Stats
  const healthy  = enriched.filter((i) => {
    const estUse7 = +((i.estimatedDailyUsage ?? 0) * 7).toFixed(1);
    return getStatus(i.currentStock, i.reorderLevel, i.currentStock - estUse7) === 'Healthy';
  }).length;

  const nextRestockDays = enriched
    .map((i) => calcDaysRemaining(i.currentStock, i.estimatedDailyUsage ?? 0))
    .filter((d) => d !== null)
    .sort((a, b) => a - b)[0] ?? null;

  // Pagination slices
  const forecastTotalPages = Math.max(1, Math.ceil(enriched.length / ITEMS_PER_PAGE));
  const pagedForecast = enriched.slice((forecastPage - 1) * ITEMS_PER_PAGE, forecastPage * ITEMS_PER_PAGE);

  const narrativeTotalPages = Math.max(1, Math.ceil(enriched.length / ITEMS_PER_PAGE));
  const pagedNarrative = enriched.slice((narrativePage - 1) * ITEMS_PER_PAGE, narrativePage * ITEMS_PER_PAGE);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Inventory</Text>
            <Text style={styles.headerSubtitle}>{branch || 'Your Branch'}</Text>
          </View>
          <MaterialCommunityIcons name="package-variant-closed" size={28} color={colors.primary} />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Stats */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll}>
          <StatCard icon="package-variant" label="Items Tracked" value={enriched.length} color={colors.primary} />
          <StatCard icon="check-circle-outline" label="Healthy" value={healthy} color={colors.success} />
          <StatCard icon="alert-outline" label="Needs Attention" value={criticalItems.length} color={colors.error} />
          <StatCard
            icon="calendar-clock"
            label="Next Restock"
            value={nextRestockDays !== null ? `~${nextRestockDays}d` : 'N/A'}
            color={colors.accent}
          />
        </ScrollView>

        {/* Stock Alerts */}
        {criticalItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Stock Alerts</Text>
              <View style={styles.alertBadge}>
                <Text style={styles.alertBadgeText}>{criticalItems.length} need attention</Text>
              </View>
            </View>
            {criticalItems.map((item) => (
              <View key={`${item.id}-alert`} style={styles.alertCard}>
                <Ionicons name="warning" size={16} color={colors.error} />
                <View style={styles.alertCardBody}>
                  <Text style={styles.alertItemName}>{item.itemName}</Text>
                  <Text style={styles.alertItemMeta}>
                    {item.currentStock} / {item.reorderLevel} {item.unit} · {item.branch}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: colors.errorLight }]}>
                  <Text style={[styles.statusText, { color: colors.error }]}>Critical</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 7-Day Forecast */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7-Day Forecast</Text>
          {pagedForecast.length === 0 ? (
            <Text style={styles.emptyText}>No inventory items found for your branch.</Text>
          ) : (
            pagedForecast.map((item) => (
              <InventoryItemCard key={item.id} item={item} />
            ))
          )}
          {forecastTotalPages > 1 && (
            <View style={styles.paginatorRow}>
              <TouchableOpacity
                style={[styles.paginatorBtn, forecastPage <= 1 && styles.paginatorBtnDisabled]}
                onPress={() => setForecastPage((p) => Math.max(1, p - 1))}
                disabled={forecastPage <= 1}
              >
                <Ionicons name="chevron-back" size={16} color={forecastPage <= 1 ? colors.disabled : colors.primary} />
                <Text style={[styles.paginatorText, forecastPage <= 1 && styles.paginatorTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.paginatorPage}>
                {forecastPage} / {forecastTotalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginatorBtn, forecastPage >= forecastTotalPages && styles.paginatorBtnDisabled]}
                onPress={() => setForecastPage((p) => Math.min(forecastTotalPages, p + 1))}
                disabled={forecastPage >= forecastTotalPages}
              >
                <Text style={[styles.paginatorText, forecastPage >= forecastTotalPages && styles.paginatorTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={forecastPage >= forecastTotalPages ? colors.disabled : colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Inventory Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inventory Recommendations</Text>
          {pagedNarrative.map((item) => (
            <NarrativeCard key={`${item.id}-narrative`} item={item} />
          ))}
          {narrativeTotalPages > 1 && (
            <View style={styles.paginatorRow}>
              <TouchableOpacity
                style={[styles.paginatorBtn, narrativePage <= 1 && styles.paginatorBtnDisabled]}
                onPress={() => setNarrativePage((p) => Math.max(1, p - 1))}
                disabled={narrativePage <= 1}
              >
                <Ionicons name="chevron-back" size={16} color={narrativePage <= 1 ? colors.disabled : colors.primary} />
                <Text style={[styles.paginatorText, narrativePage <= 1 && styles.paginatorTextDisabled]}>Prev</Text>
              </TouchableOpacity>
              <Text style={styles.paginatorPage}>
                {narrativePage} / {narrativeTotalPages}
              </Text>
              <TouchableOpacity
                style={[styles.paginatorBtn, narrativePage >= narrativeTotalPages && styles.paginatorBtnDisabled]}
                onPress={() => setNarrativePage((p) => Math.min(narrativeTotalPages, p + 1))}
                disabled={narrativePage >= narrativeTotalPages}
              >
                <Text style={[styles.paginatorText, narrativePage >= narrativeTotalPages && styles.paginatorTextDisabled]}>Next</Text>
                <Ionicons name="chevron-forward" size={16} color={narrativePage >= narrativeTotalPages ? colors.disabled : colors.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: colors.background },
  scroll:     { flex: 1 },
  content:    { padding: 16, paddingBottom: 100, gap: 16 },
  centered:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background },
  loadingText: { color: colors.textSecondary, fontSize: 14 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.errorLight, borderRadius: 10,
    padding: 12,
  },
  errorText: { color: colors.error, fontSize: 13, flex: 1 },

  statsScroll: { flexGrow: 0 },
  statCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginRight: 10,
    minWidth: 100,
    borderLeftWidth: 3,
    alignItems: 'flex-start',
    gap: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

  section:       { gap: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: colors.text },

  alertBadge: {
    backgroundColor: colors.errorLight, borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  alertBadgeText: { fontSize: 11, color: colors.error, fontWeight: '700' },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderRadius: 12, padding: 12,
    borderLeftWidth: 3, borderLeftColor: colors.error,
  },
  alertCardBody: { flex: 1 },
  alertItemName: { fontSize: 14, fontWeight: '700', color: colors.text },
  alertItemMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  itemCard: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 14, gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  itemCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  itemCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  itemCardTitles: { flex: 1 },
  itemName:       { fontSize: 14, fontWeight: '700', color: colors.text },
  itemBranch:     { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  stockRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stockLabel: { fontSize: 12, color: colors.textSecondary },
  stockValue: { fontSize: 12, fontWeight: '700', color: colors.text },

  barTrack: { height: 5, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 5, borderRadius: 3 },

  itemDetails: { gap: 4 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  detailLabel: { fontSize: 12, color: colors.textSecondary },
  detailValue: { fontSize: 12, fontWeight: '600', color: colors.text },
  negativeValue: { color: colors.error },
  criticalValue: { color: colors.error },

  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusText:  { fontSize: 11, fontWeight: '700' },

  narrativeCard: {
    borderRadius: 12, borderLeftWidth: 3, padding: 12, gap: 8,
  },
  narrativeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  narrativeDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  narrativeTitles: { flex: 1 },
  narrativeTitle:  { fontSize: 13, fontWeight: '700' },
  narrativeSubtitle: { fontSize: 11, marginTop: 1, fontWeight: '600' },
  narrativeText:   { fontSize: 12, color: colors.text, lineHeight: 18 },

  paginatorRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, paddingTop: 4,
  },
  paginatorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 7,
    backgroundColor: colors.surface, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  paginatorBtnDisabled: { opacity: 0.4 },
  paginatorText:         { fontSize: 13, fontWeight: '600', color: colors.primary },
  paginatorTextDisabled: { color: colors.disabled },
  paginatorPage:         { fontSize: 13, color: colors.textSecondary, minWidth: 60, textAlign: 'center' },

  emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 24 },
});
