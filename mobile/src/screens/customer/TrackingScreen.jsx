import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_GOOGLE, AnimatedRegion } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { bookings as bookingsApi } from '../../services/api';
import { WashingMachineLoader } from '../../components';

const GOOGLE_MAPS_API_KEY = 'AIzaSyAzAGBAijqpEZki3ZZBYe-9rxtzjF55RSY';

const SILVER_MAP_STYLE = [
  { "elementType": "geometry", "stylers": [{ "color": "#f5f5f5" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#f5f5f5" }] },
  { "featureType": "administrative.land_parcel", "elementType": "labels.text.fill", "stylers": [{ "color": "#bdbdbd" }] },
  { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "poi.park", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#ffffff" }] },
  { "featureType": "road.arterial", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#dadada" }] },
  { "featureType": "road.highway", "elementType": "labels.text.fill", "stylers": [{ "color": "#616161" }] },
  { "featureType": "road.local", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] },
  { "featureType": "transit.line", "elementType": "geometry", "stylers": [{ "color": "#e5e5e5" }] },
  { "featureType": "transit.station", "elementType": "geometry", "stylers": [{ "color": "#eeeeee" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#c9c9c9" }] },
  { "featureType": "water", "elementType": "labels.text.fill", "stylers": [{ "color": "#9e9e9e" }] }
];

const STEPS = [
  { id: 'pending', label: "Order Received", icon: "cube-outline", desc: "Your order has been received by the branch." },
  { id: 'washing', label: "Washing", icon: "water-outline", desc: "Your clothes are being washed with care." },
  { id: 'drying', label: "Drying", icon: "bonfire-outline", desc: "Your clothes are in the dryer now." },
  { id: 'ready', label: "Ready for Pickup", icon: "checkmark-circle-outline", desc: "Your laundry is clean and ready!" },
  { id: 'delivering', label: "Out for Delivery", icon: "bicycle-outline", desc: "Your driver is on the way to deliver." },
  { id: 'delivered', label: "Delivered", icon: "checkmark-done-outline", desc: "Your laundry has been delivered. Enjoy!" },
];

const TrackingScreen = ({ route, navigation }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [driverLocation, setDriverLocation] = useState(null);
  const [deliveryData, setDeliveryData] = useState(null);
  const [mapRef, setMapRef] = useState(null);
  const [driverCoordAnimated] = useState(new AnimatedRegion({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  }));

  const [etaData, setEtaData] = useState({ distance: '0.0 km', duration: '0 min' });

  // Leg Switching Logic
  const getDestination = () => {
    if (deliveryData?.status === 'DELIVERED') return destinationLoc; // Hold last loc if delivered immediately
    if (deliveryData?.leg) {
      if (deliveryData.leg === 'PICKUP_FROM_CUSTOMER') {
        if (deliveryData.status === 'EN_ROUTE_TO_PICKUP' || deliveryData.status === 'PENDING_PICKUP') {
          return {
            latitude: order?.deliveryLatitude || 14.6042,
            longitude: order?.deliveryLongitude || 121.0022,
            label: "Home",
            address: order?.deliveryAddress || "Your Location",
            type: 'home'
          };
        } else {
          return {
            latitude: order?.branchLatitude || 14.5995,
            longitude: order?.branchLongitude || 120.9842,
            label: "Branch: " + (order?.branch || "Main"),
            type: 'branch'
          };
        }
      } else if (deliveryData.leg === 'DELIVERY_TO_CUSTOMER') {
        if (deliveryData.status === 'EN_ROUTE_TO_PICKUP' || deliveryData.status === 'PENDING_PICKUP') {
          return {
            latitude: order?.branchLatitude || 14.5995,
            longitude: order?.branchLongitude || 120.9842,
            label: "Branch: " + (order?.branch || "Main"),
            type: 'branch'
          };
        } else {
          return {
            latitude: order?.deliveryLatitude || 14.6042,
            longitude: order?.deliveryLongitude || 121.0022,
            label: "Home",
            address: order?.deliveryAddress || "Your Location",
            type: 'home'
          };
        }
      }
    }

    if (order?.status === 'pending' || order?.status === 'washing' || order?.status === 'drying' || order?.status === 'ready') {
      return {
        latitude: order?.branchLatitude || 14.5995,
        longitude: order?.branchLongitude || 120.9842,
        label: "Branch: " + (order?.branch || "Main"),
        type: 'branch'
      };
    }
    return {
      latitude: order?.deliveryLatitude || 14.6042,
      longitude: order?.deliveryLongitude || 121.0022,
      label: "Home",
      address: order?.deliveryAddress || "Your Location",
      type: 'home'
    };
  };

  const getDeliveryStatusMessage = () => {
    if (deliveryData?.leg) {
      if (deliveryData.leg === 'PICKUP_FROM_CUSTOMER') {
        if (deliveryData.status === 'EN_ROUTE_TO_PICKUP' || deliveryData.status === 'PENDING_PICKUP') {
           return "Rider is coming to pick up your laundry.";
        }
        return "Rider is delivering your laundry back to the shop.";
      } else if (deliveryData.leg === 'DELIVERY_TO_CUSTOMER') {
        if (deliveryData.status === 'EN_ROUTE_TO_PICKUP' || deliveryData.status === 'PENDING_PICKUP') {
           return "Rider is picking up clean laundry from the shop.";
        }
        return "Rider is delivering your clean clothes!";
      }
    }
    return "Driver is on the way.";
  };

  const destinationLoc = getDestination();

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  useEffect(() => {
    if (order?.trackingNumber) {
      const unsub = onSnapshot(doc(db, 'deliveries', order.trackingNumber), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setDeliveryData(data);
          if (data.currentLatitude && data.currentLongitude) {
            const newCoord = {
              latitude: data.currentLatitude,
              longitude: data.currentLongitude,
            };
            setDriverLocation(newCoord);
            if (driverCoordAnimated) {
              driverCoordAnimated.timing({
                ...newCoord,
                duration: 10000, // Matched with driver's 10s broadcast interval for smooth glide
                useNativeDriver: false
              }).start();
            }
            if (mapRef) {
              mapRef.fitToCoordinates([newCoord, destinationLoc], {
                edgePadding: { top: 120, right: 80, bottom: 250, left: 80 },
                animated: true,
              });
            }
          }
        }
      });
      return () => unsub();
    }
  }, [order?.trackingNumber, mapRef, destinationLoc.latitude, destinationLoc.longitude]);

  // ETA Refresh Loop (Every 30 seconds)
  useEffect(() => {
    let etaInterval = null;
    if (order?.status === 'delivering' && driverLocation) {
      etaInterval = setInterval(() => {
        // Triggering a re-render or internal logic to refresh MapViewDirections 
        // usually happens automatically if state changes, but we can explicitly 
        // force a refresh if necessary. For now, we trust MapViewDirections 
        // component re-renders when driverLocation updates.
        console.log('Refreshing ETA calculation...');
      }, 30000);
    }
    return () => {
      if (etaInterval) clearInterval(etaInterval);
    };
  }, [order?.status, driverLocation]);

  const loadOrderDetails = async () => {
    try {
      setLoading(true);
      const data = await bookingsApi.getById(orderId);
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Order not found</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.primary, marginTop: 10 }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentStepIndex = STEPS.findIndex(s => s.id === order.status);
  const activeStep = currentStepIndex !== -1 ? STEPS[currentStepIndex] : STEPS[0];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Live Tracking</Text>
        <Text style={styles.orderNumber}>{order.trackingNumber}</Text>

        <View style={styles.trackContent}>
          {order.status === 'delivering' && driverLocation ? (
            <View>
              <View style={styles.messageBanner}>
                 <Ionicons name="information-circle" size={20} color={colors.primary} />
                 <Text style={styles.messageBannerText}>{getDeliveryStatusMessage()}</Text>
              </View>
              <View style={styles.mapContainer}>
               <MapView
                ref={(ref) => setMapRef(ref)}
                provider={PROVIDER_GOOGLE}
                style={styles.map}
                customMapStyle={SILVER_MAP_STYLE}
                initialRegion={{
                  ...driverLocation,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
               >
                  <MapViewDirections
                    origin={driverLocation}
                    destination={destinationLoc}
                    apikey={GOOGLE_MAPS_API_KEY}
                    strokeWidth={5}
                    strokeColor={colors.primary}
                    optimizeWaypoints={true}
                    onReady={result => {
                      setEtaData({
                        distance: `${result.distance.toFixed(1)} km`,
                        duration: `${Math.ceil(result.duration)} min`
                      });
                      if (mapRef) {
                        mapRef.fitToCoordinates(result.coordinates, {
                          edgePadding: { top: 120, right: 80, bottom: 280, left: 80 },
                        });
                      }
                    }}
                  />
                 <Marker 
                  coordinate={destinationLoc}
                  title={destinationLoc.label}
                  description={destinationLoc.address}
                 >
                   <View style={[
                     styles.destinationMarker, 
                     destinationLoc.type === 'branch' && { backgroundColor: colors.primary }
                   ]}>
                     <Ionicons 
                      name={destinationLoc.type === 'branch' ? "business" : "home"} 
                      size={22} 
                      color="#FFF" 
                     />
                   </View>
                 </Marker>
                 <Marker.Animated
                  coordinate={driverCoordAnimated}
                  title="Driver"
                  flat
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={[styles.driverMarkerBox, { transform: [{ rotate: `${deliveryData?.heading || 0}deg` }] }]}>
                    <MaterialCommunityIcons name="motorbike" size={28} color="#FFF" />
                  </View>
                </Marker.Animated>
               </MapView>
              <View style={styles.mapOverlay}>
                <Ionicons name="timer-outline" size={14} color="#FFF" />
                <Text style={styles.mapOverlayText}> {etaData.duration} • {etaData.distance}</Text>
              </View>
             </View>
            </View>
          ) : (
            <View style={styles.animationSection}>
              {order.status === 'washing' || order.status === 'drying' ? (
                <WashingMachineLoader size={120} />
              ) : (
                <View style={styles.statusIconBox}>
                    <Ionicons name={activeStep.icon} size={80} color={colors.primary} />
                </View>
              )}
              <Text style={styles.activeStatusText}>{activeStep.label}</Text>
              <Text style={styles.activeStatusDesc}>{activeStep.desc}</Text>
            </View>
          )}
        </View>

        <View style={styles.etaCard}>
          <View style={styles.etaInfo}>
            <Text style={styles.etaLabel}>
              {order.status === 'delivering' ? 'Real-time Arrival' : 'Estimated Completion'}
            </Text>
            <Text style={styles.etaValue}>
              {order.status === 'delivering' ? etaData.duration : (order.estimatedTime || '---')}
            </Text>
          </View>
          <View style={styles.etaDivider} />
          <View style={styles.etaInfo}>
            <Text style={styles.etaLabel}>Distance</Text>
            <Text style={styles.etaValue}>
              {order.status === 'delivering' ? etaData.distance : '---'}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.callBox}
            onPress={() => Linking.openURL(`tel:${order?.delivery?.driverPhone || '09170000000'}`)}
          >
            <Ionicons name="call" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.timelineCard}>
          <Text style={styles.timelineTitle}>Status Timeline</Text>
          <View style={styles.timelineWrapper}>
            {STEPS.map((step, index) => {
              const isPast = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;
              return (
                <View key={step.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeading}>
                    <View style={[
                      styles.dot, 
                      isPast || isCurrent ? styles.dotActive : styles.dotInactive
                    ]} />
                    {index < STEPS.length - 1 && (
                      <View style={[
                        styles.line, 
                        isPast ? styles.lineActive : styles.lineInactive
                      ]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[
                      styles.stepLabel, 
                      isPast || isCurrent ? styles.stepLabelActive : styles.stepLabelInactive
                    ]}>
                      {step.label}
                    </Text>
                    {isCurrent && <Text style={styles.currentIndicator}>Current Stage</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <TouchableOpacity 
          style={styles.detailsBtn}
          onPress={() => navigation.navigate('OrderDetail', { orderId: order.id })}
        >
          <Text style={styles.detailsBtnText}>View Full Details</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 14, fontWeight: '600', color: colors.text, marginLeft: 8 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 4 },
  orderNumber: { fontSize: 14, color: colors.textSecondary, marginBottom: 24, fontWeight: '500' },
  trackContent: { marginBottom: 20 },
  mapContainer: {
    height: 300,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 12,
  },
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 86, 219, 0.08)',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  messageBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(26, 86, 219, 0.9)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 6,
  },
  mapOverlayText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  driverMarkerBox: {
    backgroundColor: colors.primary,
    padding: 6,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  destinationMarker: {
    backgroundColor: colors.accent,
    padding: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  animationSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statusIconBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(26, 86, 219, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  activeStatusText: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 8 },
  activeStatusDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 18,
  },
  etaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  etaInfo: { flex: 1 },
  etaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.7)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  etaValue: { fontSize: 22, fontWeight: '900', color: '#FFF', marginTop: 4 },
  etaDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 20,
  },
  callBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  timelineTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 20 },
  timelineWrapper: { paddingLeft: 4 },
  timelineRow: { flexDirection: 'row', height: 50 },
  timelineLeading: { alignItems: 'center', width: 20, marginRight: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
  dotActive: { backgroundColor: colors.primary },
  dotInactive: { backgroundColor: colors.border },
  line: { width: 2, flex: 1, marginTop: -2, marginBottom: -10 },
  lineActive: { backgroundColor: colors.primary },
  lineInactive: { backgroundColor: colors.border },
  timelineContent: { flex: 1, paddingBottom: 20 },
  stepLabel: { fontSize: 14, fontWeight: '600' },
  stepLabelActive: { color: colors.text },
  stepLabelInactive: { color: colors.textTertiary },
  currentIndicator: { fontSize: 11, color: colors.primary, fontWeight: '700', marginTop: 2 },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: 'rgba(26, 86, 219, 0.05)',
    borderRadius: 16,
    gap: 8,
  },
  detailsBtnText: { fontSize: 15, fontWeight: '700', color: colors.primary },
});

export default TrackingScreen;