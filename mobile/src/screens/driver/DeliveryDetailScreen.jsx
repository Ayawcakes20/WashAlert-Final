import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, Animated as RNAnimated,
  StatusBar, Image, Linking, Platform
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { driverOrders } from '../../services/api';
import * as Location from 'expo-location';
import SwipeSlider from '../../components/SwipeSlider';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STATE_CONFIG = {
  ASSIGNED_FOR_PICKUP: { label: 'PICKUP ASSIGNED', color: '#3B82F6', destination: 'customer' },
  EN_ROUTE_TO_CUSTOMER: { label: 'HEADING TO PICKUP', color: '#F59E0B', destination: 'customer' },
  LAUNDRY_COLLECTED: { label: 'COLLECTED', color: '#10B981', destination: 'branch' },
  EN_ROUTE_TO_BRANCH: { label: 'HEADING TO BRANCH', color: '#F59E0B', destination: 'branch' },
  ASSIGNED_FOR_DELIVERY: { label: 'DELIVERY ASSIGNED', color: '#3B82F6', destination: 'customer' },
  OUT_FOR_DELIVERY: { label: 'OUT FOR DELIVERY', color: '#F59E0B', destination: 'customer' },
  DELIVERED: { label: 'DELIVERED', color: '#10B981', destination: 'none' },
};

export default function DeliveryDetailScreen({ route, navigation }) {
  const { deliveryId } = route.params;
  const insets = useSafeAreaInsets();
  
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [checklist, setChecklist] = useState([]);

  const sheetHeightAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT * 0.45)).current;

  useEffect(() => {
    loadDelivery();
  }, [deliveryId]);

  const loadDelivery = async () => {
    try {
      setLoading(true);
      const res = await driverOrders.getById(deliveryId);
      setDelivery(res);
      initChecklist(res.status);
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Unable to load task details.');
    } finally {
      setLoading(false);
    }
  };

  const initChecklist = (status) => {
    let tasks = [];
    if (status.includes('PICKUP')) {
      tasks = [
        { id: 1, label: 'Verify Customer Name & Items', done: false },
        { id: 2, label: 'Check Special Instructions', done: false },
        { id: 3, label: 'Secure Items in Delivery Bag', done: false }
      ];
    } else if (status.includes('DELIVERY')) {
      tasks = [
        { id: 1, label: 'Verify Items Count before Handover', done: false },
        { id: 2, label: 'Confirm Payment Status', done: false },
        { id: 3, label: 'Get Delivery Receipt Signed', done: false }
      ];
    }
    setChecklist(tasks);
  };

  const handleAction = async (actionType) => {
    try {
      setUpdating(true);
      await driverOrders.updateTaskStatus(deliveryId, actionType);
      loadDelivery();
    } catch (e) {
      Alert.alert('Error', 'Action failed. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const allChecked = checklist.length === 0 || checklist.every(t => t.done);

  if (loading || !delivery) return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );

  const cfg = STATE_CONFIG[delivery.status] || { label: delivery.status, color: colors.textSecondary };

  return (
    <View style={s.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Visual Header Strip */}
      <View style={[s.mapHeader, { height: SCREEN_HEIGHT * 0.3 }]}>
        <MaterialCommunityIcons name="map-marker-radius" size={48} color={colors.primary} />
        <Text style={s.mapTitle}>Live Navigation Active</Text>
      </View>

      <View style={[s.header, { top: insets.top + 16 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTracking}>TASK #{delivery.trackingNumber}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => {}}>
          <Ionicons name="navigate" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <RNAnimated.View style={[s.sheet, { height: sheetHeightAnim, paddingBottom: insets.bottom + 24 }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.sheetHandle} />
          
          <View style={s.statusRow}>
            <View style={[s.statusBadge, { backgroundColor: cfg.color + '15' }]}>
              <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>

          {/* Customer Details Breakdown */}
          <View style={s.customerSection}>
            <View style={s.customerAvatar}>
              <MaterialCommunityIcons name="account" size={32} color={colors.primary} />
            </View>
            <View style={s.customerInfo}>
              <Text style={s.customerLabel}>CUSTOMER</Text>
              <Text style={s.customerName}>{delivery.contactName || delivery.customerName}</Text>
              <Text style={s.customerPhone}>{delivery.contactPhone}</Text>
            </View>
            <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${delivery.contactPhone}`)}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.infoBlock}>
            <Text style={s.infoLabel}>DELIVERY ADDRESS</Text>
            <Text style={s.infoValue}>{delivery.deliveryAddress || 'Branch Pickup'}</Text>
          </View>

          {/* Checklist Monitoring */}
          {checklist.length > 0 && (
            <View style={s.checklistSection}>
              <Text style={s.sectionTitle}>Required Checklist</Text>
              {checklist.map(task => (
                <TouchableOpacity key={task.id} style={s.checkRow} onPress={() => toggleCheck(task.id)}>
                  <Ionicons 
                    name={task.done ? "checkbox" : "square-outline"} 
                    size={24} 
                    color={task.done ? colors.primary : colors.textTertiary} 
                  />
                  <Text style={[s.checkText, task.done && s.checkTextDone]}>{task.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Order Details Breakdown for Driver */}
          <View style={s.summarySection}>
            <Text style={s.sectionTitle}>Order Breakdown</Text>
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total Weight</Text>
                <Text style={s.summaryValue}>{delivery.actualWeightKg || delivery.loadKg || 0} kg</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Service Type</Text>
                <Text style={s.summaryValue}>{delivery.serviceType}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.totalLabel}>Collection Amount</Text>
                <Text style={s.totalValue}>₱{(delivery.finalPrice || delivery.amount || 0).toFixed(2)}</Text>
              </View>
              <View style={[s.payStatus, { backgroundColor: delivery.isPaid ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[s.payStatusText, { color: delivery.isPaid ? '#16A34A' : '#EF4444' }]}>
                  {delivery.isPaid ? 'PAID ONLINE (GCASH)' : 'COLLECT CASH ON DELIVERY'}
                </Text>
              </View>
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={s.actionArea}>
          <SwipeSlider 
            label={allChecked ? "SWIPE TO CONFIRM" : "COMPLETE CHECKLIST FIRST"}
            color={allChecked ? colors.primary : colors.textTertiary}
            disabled={!allChecked || updating}
            onComplete={() => handleAction('nextStep')}
          />
        </View>
      </RNAnimated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  mapHeader: { backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', gap: 12 },
  mapTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  header: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 20, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 10 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTracking: { fontSize: 13, fontWeight: '900', color: colors.text, letterSpacing: 0.5 },
  navBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F4FF' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, elevation: 24, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.15, shadowRadius: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  statusRow: { marginBottom: 24 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  customerSection: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, marginBottom: 20 },
  customerAvatar: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  customerInfo: { flex: 1 },
  customerLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5 },
  customerName: { fontSize: 18, fontWeight: '900', color: colors.text, marginTop: 2 },
  customerPhone: { fontSize: 13, color: colors.textTertiary, marginTop: 2 },
  callBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  infoBlock: { marginBottom: 24 },
  infoLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, letterSpacing: 0.5, marginBottom: 6 },
  infoValue: { fontSize: 14, fontWeight: '700', color: colors.text, lineHeight: 20 },
  checklistSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: colors.text, marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  checkText: { fontSize: 14, color: colors.text, fontWeight: '700' },
  checkTextDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  summarySection: { marginBottom: 32 },
  summaryCard: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: colors.textTertiary, fontWeight: '700' },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0' },
  totalLabel: { fontSize: 14, fontWeight: '900', color: colors.text },
  totalValue: { fontSize: 20, fontWeight: '900', color: colors.primary },
  payStatus: { padding: 12, borderRadius: 12, marginTop: 4 },
  payStatusText: { fontSize: 10, fontWeight: '900', textAlign: 'center' },
  actionArea: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});
