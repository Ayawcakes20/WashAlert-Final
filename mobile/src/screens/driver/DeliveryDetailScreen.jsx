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
const GOOGLE_MAPS_API_KEY = 'REPLACE_WITH_YOUR_KEY'; // This should come from config
const DARK_MAP_STYLE = []; // Custom style if needed

const STATE_CONFIG = {
  ASSIGNED_FOR_PICKUP: { label: 'Pickup Assigned', color: '#3B82F6', destination: 'customer' },
  EN_ROUTE_TO_CUSTOMER: { label: 'Heading to Pickup', color: '#F59E0B', destination: 'customer' },
  LAUNDRY_COLLECTED: { label: 'Collected', color: '#10B981', destination: 'branch' },
  EN_ROUTE_TO_BRANCH: { label: 'Heading to Branch', color: '#F59E0B', destination: 'branch' },
  ASSIGNED_FOR_DELIVERY: { label: 'Delivery Assigned', color: '#3B82F6', destination: 'customer' },
  OUT_FOR_DELIVERY: { label: 'Out for Delivery', color: '#F59E0B', destination: 'customer' },
  DELIVERED: { label: 'Delivered', color: '#10B981', destination: 'none' },
};

export default function DeliveryDetailScreen({ route, navigation }) {
  const { deliveryId } = route.params;
  const insets = useSafeAreaInsets();
  
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [driverCoords, setDriverCoords] = useState(null);
  const [etaInfo, setEtaInfo] = useState({ distance: 0, duration: 0 });
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [checklist, setChecklist] = useState([]);

  const sheetHeightAnim = useRef(new RNAnimated.Value(SCREEN_HEIGHT * 0.35)).current;
  const mapRef = useRef(null);

  useEffect(() => {
    loadDelivery();
    startLocationTracking();
  }, [deliveryId]);

  const loadDelivery = async () => {
    try {
      const res = await driverOrders.getTaskDetails(deliveryId);
      setDelivery(res);
      initChecklist(res.status);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initChecklist = (status) => {
    let tasks = [];
    if (status === 'ASSIGNED_FOR_PICKUP') {
      tasks = [
        { id: 1, label: 'Check Customer Location', done: false },
        { id: 2, label: 'Prepare Pickup Bag', done: false }
      ];
    } else if (status === 'OUT_FOR_DELIVERY') {
      tasks = [
        { id: 1, label: 'Verify Items Count', done: false },
        { id: 2, label: 'Check Payment Status', done: false },
        { id: 3, label: 'Arrival at Customer Home', done: false }
      ];
    }
    setChecklist(tasks);
  };

  const startLocationTracking = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    
    Location.watchPositionAsync({
      accuracy: Location.Accuracy.High,
      distanceInterval: 10,
    }, (loc) => {
      setDriverCoords({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        heading: loc.coords.heading,
      });
    });
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

  const renderChecklist = () => {
    if (checklist.length === 0) return null;
    return (
      <View style={s.checklistContainer}>
        <Text style={s.sectionTitle}>Task Checklist</Text>
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
    );
  };

  if (loading || !delivery) return <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /></View>;

  const cfg = STATE_CONFIG[delivery.status] || { label: delivery.status, color: colors.textSecondary };

  return (
    <View style={s.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      
      {/* Map View Placeholder - Using images/icons for visual representation if map fails */}
      <View style={s.mapPlaceholder}>
        <MaterialCommunityIcons name="map-marker-radius" size={60} color={colors.primary} />
        <Text style={s.mapText}>Live Tracking Active</Text>
      </View>

      <View style={[s.header, { top: insets.top + 16 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTracking}>Order #{delivery.trackingNumber}</Text>
        <TouchableOpacity style={s.navBtn} onPress={() => {}}>
          <Ionicons name="navigate" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <RNAnimated.View style={[s.sheet, { height: sheetHeightAnim, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.sheetHandle} />
          
          <View style={s.statusRow}>
            <View style={[s.statusBadge, { backgroundColor: cfg.color + '15' }]}>
              <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label.toUpperCase()}</Text>
            </View>
            {etaInfo.duration > 0 && (
              <Text style={s.etaText}>{etaInfo.duration} min arrival</Text>
            )}
          </View>

          <View style={s.customerCard}>
            <View style={s.customerAvatar}>
              <MaterialCommunityIcons name="account" size={32} color={colors.primary} />
            </View>
            <View style={s.customerInfo}>
              <Text style={s.customerName}>{delivery.contactName || delivery.customerName}</Text>
              <Text style={s.customerPhone}>{delivery.contactPhone || 'No phone number'}</Text>
            </View>
            <TouchableOpacity style={s.callBtn} onPress={() => Linking.openURL(`tel:${delivery.contactPhone}`)}>
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.addressRow}>
            <View style={s.addrIcon}>
              <Ionicons name="location" size={20} color={colors.primary} />
            </View>
            <View style={s.addrInfo}>
              <Text style={s.addrLabel}>Delivery Address</Text>
              <Text style={s.addrText}>{delivery.deliveryAddress}</Text>
            </View>
          </View>

          {renderChecklist()}

          <View style={s.itemsSection}>
            <Text style={s.sectionTitle}>Order Summary</Text>
            <View style={s.summaryCard}>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Total Weight</Text>
                <Text style={s.summaryValue}>{delivery.totalWeight}kg</Text>
              </View>
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Payment Method</Text>
                <Text style={s.summaryValue}>{delivery.paymentMethod || 'COD'}</Text>
              </View>
              <View style={s.divider} />
              <View style={s.summaryRow}>
                <Text style={s.totalLabel}>Amount to Collect</Text>
                <Text style={s.totalValue}>₱{delivery.finalPrice?.toFixed(2) || '0.00'}</Text>
              </View>
              <View style={[s.payBadge, { backgroundColor: delivery.isPaid ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[s.payText, { color: delivery.isPaid ? '#16A34A' : '#EF4444' }]}>
                  {delivery.isPaid ? 'PAID' : 'COLLECT CASH'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View style={s.actionArea}>
          <SwipeSlider 
            label={allChecked ? "Swipe to Confirm Action" : "Complete Checklist First"}
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
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mapPlaceholder: { flex: 1, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', gap: 12 },
  mapText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  header: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 12, borderRadius: 16, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  backBtn: { padding: 4 },
  headerTracking: { fontSize: 14, fontWeight: '800', color: colors.text },
  navBtn: { padding: 4 },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  sheetHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: '800' },
  etaText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  customerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 20, marginBottom: 20 },
  customerAvatar: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#E0E7FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 18, fontWeight: '800', color: colors.text },
  customerPhone: { fontSize: 14, color: colors.textTertiary, marginTop: 2 },
  callBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  addressRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  addrIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  addrInfo: { flex: 1 },
  addrLabel: { fontSize: 10, fontWeight: '800', color: colors.textTertiary, textTransform: 'uppercase' },
  addrText: { fontSize: 14, color: colors.text, fontWeight: '600', marginTop: 2 },
  checklistContainer: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text, marginBottom: 12 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  checkText: { fontSize: 14, color: colors.text, fontWeight: '600' },
  checkTextDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  itemsSection: { marginBottom: 24 },
  summaryCard: { backgroundColor: '#F8FAFC', padding: 20, borderRadius: 20, gap: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  summaryValue: { fontSize: 13, color: colors.text, fontWeight: '800' },
  divider: { height: 1, backgroundColor: '#E2E8F0' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  totalValue: { fontSize: 18, fontWeight: '900', color: colors.primary },
  payBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginTop: 4 },
  payText: { fontSize: 10, fontWeight: '900' },
  actionArea: { marginTop: 10 }
});
