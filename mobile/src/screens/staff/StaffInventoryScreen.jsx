import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { inventoryApi } from '../../services/api';

// ─── Asset Storage (AsyncStorage, branch-scoped) ─────────────────────────────

const assetStorageKey = (branch) => `washalert_branch_assets_mobile_${branch}`;

async function loadStoredAssets(branch) {
  try {
    const raw = await AsyncStorage.getItem(assetStorageKey(branch));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveStoredAssets(branch, assets) {
  try {
    await AsyncStorage.setItem(assetStorageKey(branch), JSON.stringify(assets));
  } catch { /* silent */ }
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const ASSET_CONDITIONS = ['Working', 'For Repair', 'Broken'];
const ASSET_CATEGORIES = ['Appliance', 'Furniture', 'Equipment', 'Electronics', 'Other'];

const ASSET_CONDITION_STYLE = {
  Working:      { bg: '#D1FAE5', text: '#065F46', icon: 'check-circle-outline' },
  'For Repair': { bg: '#FEF3C7', text: '#92400E', icon: 'alert-circle-outline' },
  Broken:       { bg: '#FEE2E2', text: '#991B1B', icon: 'close-circle-outline' },
};

// ─── Asset Form Modal ─────────────────────────────────────────────────────────

const BLANK_FORM = { name: '', category: 'Equipment', condition: 'Working', quantity: '1', unit: 'units', notes: '' };

function AssetFormModal({ visible, onClose, onSave, initial, branchName, title }) {
  const [form, setForm] = useState(initial ?? BLANK_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setForm(initial ?? BLANK_FORM);
  }, [visible, initial]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    if (!form.name.trim()) { Alert.alert('Validation', 'Asset name is required.'); return; }
    if (!form.category.trim()) { Alert.alert('Validation', 'Category is required.'); return; }
    const qty = Number(form.quantity);
    if (!qty || qty < 1) { Alert.alert('Validation', 'Quantity must be at least 1.'); return; }
    setSaving(true);
    await onSave({ ...form, quantity: qty });
    setSaving(false);
  };

  const cycleOption = (key, options) => {
    const idx = options.indexOf(form[key]);
    set(key, options[(idx + 1) % options.length]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={formStyles.container} edges={['top', 'bottom']}>
          <View style={formStyles.header}>
            <Text style={formStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={formStyles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={formStyles.scroll} contentContainerStyle={formStyles.scrollContent}>
            {/* Branch (locked) */}
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Branch</Text>
              <View style={formStyles.lockedField}>
                <Text style={formStyles.lockedText}>{branchName}</Text>
                <View style={formStyles.lockedBadge}>
                  <Ionicons name="lock-closed" size={10} color={colors.textSecondary} />
                  <Text style={formStyles.lockedBadgeText}>Your branch</Text>
                </View>
              </View>
            </View>

            {/* Item Name */}
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Item Name <Text style={formStyles.required}>*</Text></Text>
              <TextInput
                style={formStyles.input}
                value={form.name}
                onChangeText={(v) => set('name', v)}
                placeholder="e.g. Electric Fan, Aircon, Chair..."
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {/* Category */}
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Category <Text style={formStyles.required}>*</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={formStyles.chipScroll}>
                {ASSET_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[formStyles.chip, form.category === c && formStyles.chipActive]}
                    onPress={() => set('category', c)}
                  >
                    <Text style={[formStyles.chipText, form.category === c && formStyles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Condition */}
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Condition</Text>
              <TouchableOpacity
                style={[formStyles.cycleBtn, { backgroundColor: ASSET_CONDITION_STYLE[form.condition]?.bg ?? '#F3F4F6' }]}
                onPress={() => cycleOption('condition', ASSET_CONDITIONS)}
              >
                <MaterialCommunityIcons
                  name={ASSET_CONDITION_STYLE[form.condition]?.icon ?? 'circle-outline'}
                  size={16}
                  color={ASSET_CONDITION_STYLE[form.condition]?.text ?? colors.text}
                />
                <Text style={[formStyles.cycleBtnText, { color: ASSET_CONDITION_STYLE[form.condition]?.text ?? colors.text }]}>
                  {form.condition}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={ASSET_CONDITION_STYLE[form.condition]?.text ?? colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quantity + Unit */}
            <View style={formStyles.row}>
              <View style={[formStyles.field, { flex: 1 }]}>
                <Text style={formStyles.label}>Quantity <Text style={formStyles.required}>*</Text></Text>
                <TextInput
                  style={formStyles.input}
                  value={String(form.quantity)}
                  onChangeText={(v) => set('quantity', v)}
                  keyboardType="numeric"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <View style={[formStyles.field, { flex: 1 }]}>
                <Text style={formStyles.label}>Unit</Text>
                <TextInput
                  style={formStyles.input}
                  value={form.unit}
                  onChangeText={(v) => set('unit', v)}
                  placeholder="units"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Notes */}
            <View style={formStyles.field}>
              <Text style={formStyles.label}>Notes <Text style={formStyles.optional}>(optional)</Text></Text>
              <TextInput
                style={[formStyles.input, formStyles.textArea]}
                value={form.notes}
                onChangeText={(v) => set('notes', v)}
                placeholder="Location, serial number, remarks..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          <View style={formStyles.footer}>
            <TouchableOpacity style={formStyles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={formStyles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[formStyles.saveBtn, saving && formStyles.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={formStyles.saveText}>Save Item</Text>}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const formStyles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:        { fontSize: 17, fontWeight: '700', color: colors.text },
  closeBtn:     { padding: 4 },
  scroll:       { flex: 1 },
  scrollContent: { padding: 16, gap: 16, paddingBottom: 24 },
  field:        { gap: 6 },
  label:        { fontSize: 13, fontWeight: '600', color: colors.text },
  required:     { color: colors.error },
  optional:     { color: colors.textSecondary, fontWeight: '400' },
  input:        { backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.border },
  textArea:     { minHeight: 72, textAlignVertical: 'top' },
  row:          { flexDirection: 'row', gap: 12 },
  lockedField:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: colors.border },
  lockedText:   { fontSize: 14, color: colors.text, fontWeight: '600' },
  lockedBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  lockedBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  chipScroll:   { flexGrow: 0 },
  chip:         { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, marginRight: 8 },
  chipActive:   { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText:     { fontSize: 13, color: colors.text, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  cycleBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12 },
  cycleBtnText: { fontSize: 14, fontWeight: '700', flex: 1 },
  footer:       { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  cancelBtn:    { flex: 1, padding: 14, borderRadius: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  cancelText:   { fontSize: 14, fontWeight: '600', color: colors.text },
  saveBtn:      { flex: 2, padding: 14, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.6 },
  saveText:     { fontSize: 14, fontWeight: '700', color: '#fff' },
});

// ─── Asset Card (with edit / delete) ─────────────────────────────────────────

function AssetCard({ asset, onEdit, onDelete }) {
  const style = ASSET_CONDITION_STYLE[asset.condition] ?? ASSET_CONDITION_STYLE['For Repair'];
  return (
    <View style={assetStyles.card}>
      <View style={assetStyles.cardHeader}>
        <View style={assetStyles.cardLeft}>
          <MaterialCommunityIcons name="cube-outline" size={18} color={colors.accent} />
          <View style={assetStyles.cardTitles}>
            <Text style={assetStyles.assetName}>{asset.name}</Text>
            <Text style={assetStyles.assetMeta}>{asset.category} · {asset.quantity} {asset.unit ?? 'units'}</Text>
          </View>
        </View>
        <View style={[assetStyles.condBadge, { backgroundColor: style.bg }]}>
          <MaterialCommunityIcons name={style.icon} size={12} color={style.text} />
          <Text style={[assetStyles.condText, { color: style.text }]}>{asset.condition}</Text>
        </View>
      </View>
      {asset.notes ? <Text style={assetStyles.assetNotes} numberOfLines={2}>{asset.notes}</Text> : null}
      <View style={assetStyles.cardActions}>
        <TouchableOpacity style={assetStyles.actionBtn} onPress={onEdit}>
          <Ionicons name="create-outline" size={14} color={colors.primary} />
          <Text style={[assetStyles.actionText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[assetStyles.actionBtn, assetStyles.actionBtnDelete]} onPress={onDelete}>
          <Ionicons name="trash-outline" size={14} color={colors.error} />
          <Text style={[assetStyles.actionText, { color: colors.error }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const assetStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 12, gap: 8,
    shadowColor: colors.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  cardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  cardTitles: { flex: 1 },
  assetName:  { fontSize: 13, fontWeight: '700', color: colors.text },
  assetMeta:  { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  assetNotes: { fontSize: 11, color: colors.textSecondary },
  condBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  condText:   { fontSize: 10, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 8, paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border },
  actionBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: colors.background },
  actionBtnDelete: { marginLeft: 'auto' },
  actionText:  { fontSize: 12, fontWeight: '600' },
});

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
  const [branchAssets, setBranchAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [forecastPage, setForecastPage] = useState(1);
  const [narrativePage, setNarrativePage] = useState(1);

  // Asset modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const loadAssets = useCallback(async () => {
    const stored = await loadStoredAssets(branch);
    setBranchAssets(stored);
  }, [branch]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [inv, fc] = await Promise.all([
        inventoryApi.list(branch),
        inventoryApi.forecast(30, branch),
      ]);
      setInventory(Array.isArray(inv) ? inv : []);
      setForecast(Array.isArray(fc) ? fc : []);
      await loadAssets();
    } catch (_err) {
      setError('Unable to load inventory. Pull down to retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [branch, loadAssets]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  // Asset CRUD handlers
  const handleAddAsset = async (formData) => {
    const newAsset = {
      id: generateId(),
      name: formData.name.trim(),
      category: formData.category,
      condition: formData.condition,
      quantity: formData.quantity,
      unit: formData.unit.trim() || 'units',
      notes: formData.notes.trim(),
      branch,
      addedAt: new Date().toISOString(),
    };
    const updated = [...branchAssets, newAsset];
    await saveStoredAssets(branch, updated);
    setBranchAssets(updated);
    setAddModalOpen(false);
  };

  const handleEditAsset = async (formData) => {
    if (!editTarget) return;
    const updated = branchAssets.map((a) =>
      a.id === editTarget.id
        ? {
            ...a,
            name: formData.name.trim(),
            category: formData.category,
            condition: formData.condition,
            quantity: formData.quantity,
            unit: formData.unit.trim() || 'units',
            notes: formData.notes.trim(),
          }
        : a,
    );
    await saveStoredAssets(branch, updated);
    setBranchAssets(updated);
    setEditModalOpen(false);
    setEditTarget(null);
  };

  const confirmDelete = (asset) => {
    Alert.alert(
      'Delete Asset',
      `Are you sure you want to delete "${asset.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            const updated = branchAssets.filter((a) => a.id !== asset.id);
            await saveStoredAssets(branch, updated);
            setBranchAssets(updated);
          },
        },
      ],
    );
  };

  const openEdit = (asset) => {
    setEditTarget(asset);
    setEditModalOpen(true);
  };

  // Merge forecast data into inventory
  const enriched = inventory.map((item) => {
    const fc = forecast.find(
      (f) => f.itemName === item.itemName && f.branch === item.branch,
    );
    return { ...item, estimatedDailyUsage: fc?.estimatedDailyUsage ?? 0 };
  });

  const criticalItems = enriched.filter((i) => {
    const estUse7 = +((i.estimatedDailyUsage ?? 0) * 7).toFixed(1);
    const after7 = +(i.currentStock - estUse7).toFixed(1);
    return getStatus(i.currentStock, i.reorderLevel, after7) === 'Critical';
  });

  const healthy = enriched.filter((i) => {
    const estUse7 = +((i.estimatedDailyUsage ?? 0) * 7).toFixed(1);
    return getStatus(i.currentStock, i.reorderLevel, i.currentStock - estUse7) === 'Healthy';
  }).length;

  const nextRestockDays = enriched
    .map((i) => calcDaysRemaining(i.currentStock, i.estimatedDailyUsage ?? 0))
    .filter((d) => d !== null)
    .sort((a, b) => a - b)[0] ?? null;

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

        {/* Branch Assets — full CRUD, own branch */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Branch Assets</Text>
              <Text style={styles.assetSubtitle}>Equipment and furniture — {branch || 'your branch'}</Text>
            </View>
            <TouchableOpacity style={styles.addAssetBtn} onPress={() => setAddModalOpen(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={styles.addAssetText}>Add</Text>
            </TouchableOpacity>
          </View>

          {branchAssets.length === 0 ? (
            <View style={styles.emptyAssets}>
              <MaterialCommunityIcons name="cube-outline" size={32} color={colors.textSecondary} style={{ opacity: 0.4 }} />
              <Text style={styles.emptyText}>No assets recorded for your branch yet.</Text>
              <TouchableOpacity style={styles.emptyAddBtn} onPress={() => setAddModalOpen(true)}>
                <Text style={styles.emptyAddText}>+ Add First Item</Text>
              </TouchableOpacity>
            </View>
          ) : (
            branchAssets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                onEdit={() => openEdit(asset)}
                onDelete={() => confirmDelete(asset)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Asset Modal */}
      <AssetFormModal
        visible={addModalOpen}
        title="Add Branch Asset"
        branchName={branch || 'Your Branch'}
        onClose={() => setAddModalOpen(false)}
        onSave={handleAddAsset}
      />

      {/* Edit Asset Modal */}
      <AssetFormModal
        visible={editModalOpen}
        title="Edit Branch Asset"
        branchName={branch || 'Your Branch'}
        initial={editTarget ? {
          name: editTarget.name,
          category: editTarget.category,
          condition: editTarget.condition,
          quantity: String(editTarget.quantity),
          unit: editTarget.unit ?? 'units',
          notes: editTarget.notes ?? '',
        } : undefined}
        onClose={() => { setEditModalOpen(false); setEditTarget(null); }}
        onSave={handleEditAsset}
      />
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

  emptyText:    { fontSize: 14, color: colors.textSecondary, textAlign: 'center', paddingVertical: 8 },
  assetSubtitle: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  addAssetBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  addAssetText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  emptyAssets: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  emptyAddBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: colors.primary, borderRadius: 10,
  },
  emptyAddText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
