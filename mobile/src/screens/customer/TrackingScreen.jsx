import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { MapView, Marker, PROVIDER_GOOGLE, AnimatedRegion, MapViewDirections } from '../../components/SafeMap';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { colors } from '../../theme/colors';
import { bookings as bookingsApi } from '../../services/api';
import { WashingMachineLoader } from '../../components';
import { GOOGLE_MAPS_API_KEY } from '../../config/env';

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
  { id: 'pending',          label: 'Order Received',          icon: 'cube-outline',            desc: 'Your order has been received by the branch.' },
  { id: 'pickup_heading',   label: 'Rider Heading to You',    icon: 'bicycle-outline',          desc: 'Your rider is on the way to collect your laundry.' },
  { id: 'pickup_arrived',   label: 'Rider at Your Door',      icon: 'location-outline',         desc: 'Your rider has arrived! Please hand over your laundry.' },
  { id: 'at_shop',          label: 'Laundry at Branch',       icon: 'storefront-outline',       desc: 'Your laundry is at the branch and being processed.' },
  { id: 'washing',          label: 'Washing',                 icon: 'water-outline',            desc: 'Your clothes are being washed with care.' },
  { id: 'drying',           label: 'Drying',                  icon: 'bonfire-outline',          desc: 'Your clothes are in the dryer now.' },
  { id: 'ready',            label: 'Ready for Delivery',      icon: 'checkmark-circle-outline', desc: 'Your laundry is clean and ready!' },
  { id: 'delivering',       label: 'Out for Delivery',        icon: 'bicycle-outline',          desc: 'Your rider is on the way to deliver your clean laundry.' },
  { id: 'delivery_arrived', label: 'Rider at Your Door',      icon: 'location-outline',         desc: 'Your clean laundry has arrived!' },
  { id: 'delivered',        label: 'Delivered',               icon: 'checkmark-done-outline',   desc: 'Your laundry has been delivered. Enjoy!' },
];

// Maps all 9 driver workflow statuses to a customer-facing order status
const mapWorkflowToOrderStatus = (workflowStatus, fallback = 'pending') => {
  const normalized = String(workflowStatus || '').toLowerCase();
  switch (normalized) {
    // Phase A — driver picking up from customer
    case 'accepted':           return 'pickup_heading';   // Rider heading to you
    case 'at_customer':        return 'pickup_arrived';   // Rider at your door
    case 'picked_up':          return 'at_shop';          // On the way to branch
    case 'at_branch':          return 'at_shop';          // At branch
    case 'handed_over':        return 'washing';          // Being processed
    // Phase B — driver delivering clean laundry
    case 'ready_for_dispatch': return 'ready';            // Ready to deliver
    case 'en_route':           return 'delivering';       // On the way to you
    case 'at_delivery':        return 'delivery_arrived'; // Driver at your door
    case 'completed':          return 'delivered';
    case 'cancelled':          return 'cancelled';
    default:
      if (normalized) return fallback;
      return fallback;
  }
};

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
    const wf = String(deliveryData?.status || '').toLowerCase();
    switch (wf) {
      case 'accepted':           return '🏍️  Rider is heading to pick up your laundry.';
      case 'at_customer':        return '📦  Rider has arrived at your location!';
      case 'picked_up':          return '🚀  Laundry picked up — heading to the branch.';
      case 'at_branch':          return '🏬  Laundry arrived at the branch.';
      case 'handed_over':        return '🧺  Your laundry is being processed at the branch.';
      case 'ready_for_dispatch': return '✅  Clean laundry is ready — waiting for dispatch!';
      case 'en_route':           return '🏍️  Rider is on the way to deliver your clean laundry!';
      case 'at_delivery':        return '🎉  Rider has arrived at your door!';
      case 'completed':          return '✅  Delivered successfully. Enjoy!';
      default:                   return '📍  Tracking your laundry order...';
    }
  };

  const destinationLoc = getDestination();

  useEffect(() => {
    loadOrderDetails();
  }, [orderId]);

  useEffect(() => {
    // Try trackingNumber first, fall back to order.id — both may be used as Firestore doc key
    const firestoreKey = order?.trackingNumber || order?.id;
    if (!firestoreKey) return;

    console.log('[Tracking] Attaching Firestore listener key=', firestoreKey);
    const unsub = onSnapshot(
      doc(db, 'deliveries', String(firestoreKey)),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[Tracking] Firestore update key=', firestoreKey, 'status=', data?.status, 'workflow=', data?.workflowStatus, 'lat=', data?.currentLatitude);
          setDeliveryData(data);
          setOrder((prev) =>
            prev
              ? {
                  ...prev,
                  // Use workflowStatus if present, otherwise fall back to Firestore status field
                  status: mapWorkflowToOrderStatus(
                    data?.workflowStatus || data?.status,
                    prev.status
                  ),
                  delivery: {
                    ...(prev.delivery || {}),
                    driver: data?.driverName || prev.delivery?.driver || 'Assigned Driver',
                    driverPhone: data?.driverPhone || prev.delivery?.driverPhone || '',
                    driverPhotoUrl: data?.driverPhotoUrl || prev.delivery?.driverPhotoUrl || null,
                    driverVehicle: data?.driverVehicle || prev.delivery?.driverVehicle || null,
                    eta: data?.estimatedArrivalAt || prev.delivery?.eta || null,
                  },
                }
              : prev
          );
          if (data.currentLatitude && data.currentLongitude) {
            const newCoord = {
              latitude: data.currentLatitude,
              longitude: data.currentLongitude,
            };
            setDriverLocation(newCoord);
            if (driverCoordAnimated) {
              driverCoordAnimated.timing({
                ...newCoord,
                duration: 2000, // Faster glide (2s) for more responsive feel
                useNativeDriver: false
              }).start();
            }
            
            // Only auto-fit once or when significantly moved to avoid camera jitter
            if (mapRef && !prev.driverLocation) {
              mapRef.fitToCoordinates([newCoord, destinationLoc], {
                edgePadding: { top: 120, right: 80, bottom: 250, left: 80 },
                animated: true,
              });
            }
          }
        } else {
          console.log('[Tracking] Firestore doc does not exist yet key=', firestoreKey);
        }
      },
      (error) => {
        console.warn('[Tracking] Firestore listener failed:', error?.message || error);
      }
    );
    return () => unsub();
  }, [order?.trackingNumber, order?.id, mapRef, destinationLoc.latitude, destinationLoc.longitude]);


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

  const openPhoneDriver = async () => {
    const phone = String(order?.delivery?.driverPhone || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      Alert.alert('No Contact', 'Driver phone number is not available yet.');
      return;
    }
    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to Call', 'This device cannot open the dialer.');
      return;
    }
    await Linking.openURL(url);
  };

  const openMessageDriver = async () => {
    const phone = String(order?.delivery?.driverPhone || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      Alert.alert('No Contact', 'Driver phone number is not available yet.');
      return;
    }
    const url = `sms:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Unable to Message', 'This device cannot open messaging.');
      return;
    }
    await Linking.openURL(url);
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
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.trackContent}>
          {/* Status message banner — always visible */}
          {deliveryData && (
            <View style={styles.messageBanner}>
              <Text style={styles.messageBannerText}>{getDeliveryStatusMessage()}</Text>
            </View>
          )}

          {/* Map — always show when we have any coordinate reference */}
          {(driverLocation || destinationLoc) ? (
            <View style={styles.mapContainer}>
              <MapView
                ref={(ref) => setMapRef(ref)}
                provider={PROVIDER_GOOGLE}
                googleMapsApiKey={GOOGLE_MAPS_API_KEY}
                style={styles.map}
                customMapStyle={SILVER_MAP_STYLE}
                initialRegion={{
                  ...(driverLocation || destinationLoc),
                  latitudeDelta: 0.015,
                  longitudeDelta: 0.015,
                }}
              >
                {/* Route polyline — only when driver is moving */}
                {driverLocation && (
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
                )}

                {/* Destination pin */}
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
                      name={destinationLoc.type === 'branch' ? 'business' : 'home'}
                      size={22}
                      color="#FFF"
                    />
                  </View>
                </Marker>

                {/* Driver marker — animated when moving */}
                {driverLocation && (
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
                )}
              </MapView>

              {/* Order number chip — top left */}
              <View style={styles.orderChip}>
                <Ionicons name="receipt-outline" size={12} color={colors.primary} />
                <Text style={styles.orderChipText}>{order.trackingNumber}</Text>
              </View>

              {/* Live ETA overlay — top right */}
              {driverLocation && (
                <View style={styles.mapOverlay}>
                  <Ionicons name="timer-outline" size={14} color="#FFF" />
                  <Text style={styles.mapOverlayText}>
                    {' '}{etaData.duration}  •  {etaData.distance}
                  </Text>
                </View>
              )}

              {/* Driver name chip — bottom */}
              {order?.delivery?.driver && (
                <View style={styles.driverChip}>
                  <View style={styles.driverChipAvatar}>
                    <Ionicons name="person" size={12} color={colors.primary} />
                  </View>
                  <Text style={styles.driverChipText}>{order.delivery.driver}</Text>
                  {order.delivery.driverPhone ? (
                    <TouchableOpacity
                      style={styles.driverChipCall}
                      onPress={() => void openPhoneDriver()}
                    >
                      <Ionicons name="call" size={12} color="#FFF" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}
            </View>
          ) : (
            /* Fallback animation when no coordinates at all */
            <View style={styles.animationSection}>
              {order.status === 'washing' || order.status === 'drying' || order.status === 'at_shop' ? (
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
            onPress={() => void openPhoneDriver()}
          >
            <Ionicons name="call" size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {order?.delivery ? (
          <View style={styles.driverCard}>
            <Text style={styles.timelineTitle}>Driver Details</Text>
            {order.delivery.driverPhotoUrl ? (
              <Image source={{ uri: order.delivery.driverPhotoUrl }} style={styles.driverPhoto} />
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Name</Text>
              <Text style={styles.infoValue}>{order.delivery.driver || 'Assigned Driver'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Phone</Text>
              <Text style={styles.infoValue}>{order.delivery.driverPhone || 'N/A'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>Vehicle</Text>
              <Text style={styles.infoValue}>{order.delivery.driverVehicle || 'Not provided'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>ETA</Text>
              <Text style={styles.infoValue}>
                {order.delivery.eta ? new Date(order.delivery.eta).toLocaleString() : etaData.duration}
              </Text>
            </View>
            <View style={styles.contactRow}>
              <TouchableOpacity style={styles.contactBtn} onPress={() => void openPhoneDriver()}>
                <Ionicons name="call-outline" size={14} color={colors.primary} />
                <Text style={styles.contactBtnText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactBtn} onPress={() => void openMessageDriver()}>
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                <Text style={styles.contactBtnText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

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
  trackContent: { marginBottom: 20 },
  mapContainer: {
    height: 440,
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
  orderChip: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 4,
  },
  orderChipText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  mapOverlay: {
    position: 'absolute',
    top: 16,
    right: 16,
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
  driverChip: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  driverChipAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverChipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0D1B2A',
  },
  driverChipCall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  driverCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  driverPhoto: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignSelf: 'center',
    marginBottom: 12,
    backgroundColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoKey: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    maxWidth: '65%',
    textAlign: 'right',
  },
  contactRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  contactBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
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
