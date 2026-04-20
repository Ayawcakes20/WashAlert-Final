import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { MapView, Marker, PROVIDER_GOOGLE, MapViewDirections } from '../../components/SafeMap';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { deliveries as deliveriesApi } from '../../services/api';
import { GOOGLE_MAPS_API_KEY } from '../../config/env';
import { useAuth } from '../../context/AuthContext';
import { uploadImageAsync } from '../../services/storageService';

const STATUS_STEPS = [
  { id: 'pending', label: 'Assigned' },
  { id: 'en_route', label: 'En Route' },
  { id: 'picked_up', label: 'Picked Up' },
  { id: 'in_progress', label: 'In Transit' },
  { id: 'completed', label: 'Delivered' },
];

const getStatusLabel = (status) => {
  if (status === 'pending') return 'Pending Pickup';
  if (status === 'en_route') return 'En Route to Pickup';
  if (status === 'picked_up') return 'Picked Up';
  if (status === 'in_progress') return 'In Transit';
  if (status === 'completed') return 'Delivered';
  if (status === 'failed') return 'Failed';
  return 'Pending';
};

const DeliveryDetailScreen = ({ route, navigation }) => {
  const { user, firebaseIdToken } = useAuth();
  const deliveryId = route?.params?.deliveryId;
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploadingProofType, setUploadingProofType] = useState('');
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const [driverCoords, setDriverCoords] = useState(null);
  const [mapRegion, setMapRegion] = useState(null);

  useEffect(() => {
    loadDelivery();
  }, [deliveryId]);

  useEffect(() => {
    let updateInterval = null;
    let active = true;

    const startTracking = async () => {
      try {
        const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
        if (fgStatus !== 'granted') {
          console.warn('[DriverTracking] Foreground location permission denied');
          return;
        }
        updateInterval = setInterval(async () => {
          if (!active || isSimulating) return;
          try {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const coords = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading || 0,
            };
            setDriverCoords(coords);
            if (delivery?.orderNumber) {
              const deliveryRef = doc(db, 'deliveries', delivery.orderNumber);
              await setDoc(
                deliveryRef,
                {
                  currentLatitude: coords.latitude,
                  currentLongitude: coords.longitude,
                  heading: coords.heading,
                  lastUpdated: serverTimestamp(),
                },
                { merge: true }
              );
            }
            if (delivery?.id) {
              await deliveriesApi.updateLocation(delivery.id, {
                latitude: coords.latitude,
                longitude: coords.longitude,
              });
            }
            console.log('[DriverTracking] location synced deliveryId=', delivery?.id);
          } catch (err) {
            console.warn('[DriverTracking] location sync failed:', err?.message || err);
          }
        }, 10000);
      } catch (err) {
        console.warn('[DriverTracking] Unable to start tracking:', err?.message || err);
      }
    };

    const stopTracking = () => {
      active = false;
      if (updateInterval) clearInterval(updateInterval);
    };

    if (delivery?.status === 'in_progress' && !isSimulating) {
      void startTracking();
    } else {
      stopTracking();
    }

    return () => stopTracking();
  }, [delivery?.status, delivery?.orderNumber, isSimulating]);

  // Simulation Effect
  useEffect(() => {
    let simInterval = null;
    if (isSimulating && delivery?.orderNumber) {
      let step = 0;
      // Start near standard Manila area mock coords
      const startLat = 14.5995;
      const startLng = 120.9842;
      
      simInterval = setInterval(async () => {
        step += 1;
        const newLat = startLat + (step * 0.0005);
        const newLng = startLng + (step * 0.0003);
        
        try {
          const deliveryRef = doc(db, 'deliveries', delivery.orderNumber);
          await setDoc(deliveryRef, {
            currentLatitude: newLat,
            currentLongitude: newLng,
            heading: 45, // Constant heading for mock
            lastUpdated: serverTimestamp(),
          }, { merge: true });
        } catch (e) {
          console.error('Simulation update failed:', e);
        }
      }, 5000);
    }
    return () => {
      if (simInterval) clearInterval(simInterval);
    };
  }, [isSimulating, delivery?.orderNumber]);

  const loadDelivery = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await deliveriesApi.getById(deliveryId);
      setDelivery(data);
      if (data) {
        setMapRegion({
          latitude: data.currentLatitude || 14.5995,
          longitude: data.currentLongitude || 120.9842,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        });
      }
    } catch (e) {
      setDelivery(null);
      setError(e?.message || 'Unable to load delivery details.');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (targetStatus) => {
    if (!delivery?.id || updating) return;
    setShowConfirm(null);
    try {
      setUpdating(true);
      await deliveriesApi.updateStatus(delivery.id, targetStatus);
      await loadDelivery();
    } catch (e) {
      Alert.alert('Update Failed', e?.message || 'Unable to update delivery status.');
    } finally {
      setUpdating(false);
    }
  };

  const handleUploadProof = async (proofType) => {
    if (!delivery?.id || !firebaseIdToken || uploadingProofType) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Permission Required', 'Allow photo access to upload proof images.');
        return;
      }

      const picker = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });
      if (picker?.canceled || !picker?.assets?.length) return;

      setUploadingProofType(proofType);
      console.log(
        '[DriverProof] Upload start deliveryId=',
        delivery.id,
        'tracking=',
        delivery.orderNumber,
        'proofType=',
        proofType,
        'driverId=',
        user?.id
      );
      const upload = await uploadImageAsync(picker.assets[0].uri, {
        idToken: firebaseIdToken,
        folder: `deliveries/${delivery.orderNumber || delivery.id}/proofs`,
        fileName: `${proofType.toLowerCase()}_${Date.now()}.jpg`,
      });

      await deliveriesApi.uploadProof(delivery.id, proofType, upload.downloadURL);
      await loadDelivery();
      Alert.alert('Proof Uploaded', `${proofType === 'PICKUP' ? 'Pickup' : 'Drop-off'} proof uploaded.`);
    } catch (error) {
      console.error('[DriverProof] Upload failed:', error);
      Alert.alert('Upload Failed', error?.message || 'Unable to upload proof right now.');
    } finally {
      setUploadingProofType('');
    }
  };

  const getTargetCoords = () => {
    if (!delivery) return null;
    if (delivery.leg === 'PICKUP_FROM_CUSTOMER') {
      if (delivery.status === 'pending' || delivery.status === 'en_route') {
        return {
          latitude: delivery.deliveryLatitude || 14.5995,
          longitude: delivery.deliveryLongitude || 120.9842,
          label: 'Pickup from: ' + delivery.customerName
        };
      } else {
        return {
          latitude: delivery.branchLatitude || 14.5995,
          longitude: delivery.branchLongitude || 120.9842,
          label: 'Deliver to: ' + (delivery.branchName || "Branch")
        };
      }
    } else {
      if (delivery.status === 'pending' || delivery.status === 'en_route') {
        return {
          latitude: delivery.branchLatitude || 14.5995,
          longitude: delivery.branchLongitude || 120.9842,
          label: 'Pickup from: ' + (delivery.branchName || "Branch")
        };
      } else {
        return {
          latitude: delivery.deliveryLatitude || 14.5995,
          longitude: delivery.deliveryLongitude || 120.9842,
          label: 'Deliver to: ' + delivery.customerName
        };
      }
    }
  };

  const openMaps = () => {
    const target = getTargetCoords();
    if (!target) return;
    Linking.openURL(
      `https://www.google.com/maps/dir/?api=1&destination=${target.latitude},${target.longitude}`
    );
  };

  const openPhone = async (phoneNumber) => {
    const phone = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      Alert.alert('No Contact', 'Phone number is not available for this delivery.');
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

  const openMessage = async (phoneNumber) => {
    const phone = String(phoneNumber || '').replace(/[^0-9+]/g, '');
    if (!phone) {
      Alert.alert('No Contact', 'Phone number is not available for this delivery.');
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

  const statusIndex = STATUS_STEPS.findIndex((step) => step.id === delivery?.status);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.errorText}>{error || 'Delivery not found.'}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.mapBtn}>
            <Text style={styles.mapBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{delivery.customerName}</Text>
        <Text style={styles.orderId}>{delivery.orderNumber}</Text>
        <Text style={styles.statusLabel}>{getStatusLabel(delivery.status)}</Text>

        <View style={styles.mapCard}>
           <MapView
             provider={PROVIDER_GOOGLE}
             style={styles.map}
             region={mapRegion}
             onRegionChangeComplete={setMapRegion}
           >
             {driverCoords && (
               <Marker
                 coordinate={driverCoords}
                 title="You"
                 rotation={driverCoords.heading}
               >
                 <View style={styles.driverMarker}>
                   <Ionicons name="bicycle" size={24} color={colors.primary} />
                 </View>
               </Marker>
             )}
             {driverCoords && getTargetCoords() && (
               <MapViewDirections
                 origin={driverCoords}
                 destination={getTargetCoords()}
                 apikey={GOOGLE_MAPS_API_KEY}
                 strokeWidth={4}
                 strokeColor={colors.primary}
                 optimizeWaypoints={true}
                 mode="DRIVING"
                 onReady={(result) => {
                    // Optionally adjust map to fit the whole route
                 }}
               />
             )}
             {getTargetCoords() && (
               <Marker
                 coordinate={getTargetCoords()}
                 title="Destination"
                 pinColor={colors.accent}
               />
             )}
           </MapView>
           <View style={styles.mapOverlay}>
              <Text style={styles.mapOverlayText}>{getTargetCoords()?.label}</Text>
           </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          <View style={styles.addressRowBlock}>
            <Ionicons name="location" size={16} color={colors.primary} style={{ marginTop: 2 }} />
            <Text style={styles.addressText}>{delivery.deliveryAddress || 'No address provided'}</Text>
            <TouchableOpacity style={styles.copyBtn} onPress={() => Alert.alert('Info', 'Address copied.')}>
              <Ionicons name="copy-outline" size={14} color={colors.primary} />
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Order #</Text>
            <Text style={styles.infoVal}>{delivery.orderNumber}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Branch</Text>
            <Text style={styles.infoVal}>{delivery.branchName || 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Phone</Text>
            <Text style={styles.infoVal}>{delivery.customerPhone || 'N/A'}</Text>
          </View>
          <View style={styles.contactActionRow}>
            <TouchableOpacity style={styles.contactActionBtn} onPress={() => void openPhone(delivery.customerPhone)}>
              <Ionicons name="call-outline" size={14} color={colors.primary} />
              <Text style={styles.contactActionText}>Call Customer</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.contactActionBtn} onPress={() => void openMessage(delivery.customerPhone)}>
              <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
              <Text style={styles.contactActionText}>Message Customer</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Driver</Text>
            <Text style={styles.infoVal}>{delivery.driverName || 'Unassigned'}</Text>
          </View>
          {delivery.notes ? (
            <View style={styles.instructionsBox}>
              <View style={styles.insRow}>
                <Ionicons name="information-circle-outline" size={14} color={colors.warning} />
                <Text style={styles.insTitle}>Notes</Text>
              </View>
              <Text style={styles.insBody}>{delivery.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Status</Text>
          <View style={styles.timelineCol}>
            {STATUS_STEPS.map((step, index) => {
              const done = statusIndex >= index || delivery.status === 'completed';
              return (
                <View key={step.id} style={styles.timelineRow}>
                  <View style={styles.timelineIconArea}>
                    <View style={[styles.timeDot, done ? styles.timeDotActive : styles.timeDotInactive]} />
                    {index < STATUS_STEPS.length - 1 && (
                      <View style={[styles.timeLine, done ? styles.timeLineActive : styles.timeLineInactive]} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={[styles.timelineStep, done ? styles.timelineStepActive : styles.timelineStepInactive]}>
                      {step.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Photo Proof</Text>
          <View style={styles.proofActionRow}>
            <TouchableOpacity
              style={styles.proofBtn}
              onPress={() => handleUploadProof('PICKUP')}
              disabled={!!uploadingProofType}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.proofBtnText}>
                {uploadingProofType === 'PICKUP' ? 'Uploading...' : 'Upload Pickup'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.proofBtn}
              onPress={() => handleUploadProof('DROPOFF')}
              disabled={!!uploadingProofType}
            >
              <Ionicons name="camera-outline" size={16} color={colors.primary} />
              <Text style={styles.proofBtnText}>
                {uploadingProofType === 'DROPOFF' ? 'Uploading...' : 'Upload Drop-off'}
              </Text>
            </TouchableOpacity>
          </View>
          {delivery.pickupProofUrl ? (
            <View style={styles.proofPreview}>
              <Text style={styles.proofLabel}>Pickup Proof</Text>
              <Image source={{ uri: delivery.pickupProofUrl }} style={styles.proofImage} />
            </View>
          ) : null}
          {delivery.dropoffProofUrl ? (
            <View style={styles.proofPreview}>
              <Text style={styles.proofLabel}>Drop-off Proof</Text>
              <Image source={{ uri: delivery.dropoffProofUrl }} style={styles.proofImage} />
            </View>
          ) : null}
        </View>

        <View style={styles.actionsBox}>
          <TouchableOpacity style={styles.mapBtn} onPress={openMaps}>
            <Ionicons name="navigate" size={20} color={colors.primary} />
            <Text style={styles.mapBtnText}>Open in Maps</Text>
          </TouchableOpacity>

          {delivery.status === 'pending' &&
            (showConfirm === 'en_route' ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Start journey to pickup location?</Text>
                <View style={styles.confirmRowBtn}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryConfirmBtn}
                    onPress={() => handleAction('en_route')}
                    disabled={updating}
                  >
                    <Text style={styles.primaryConfirmBtnText}>Start Journey</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => setShowConfirm('en_route')}
                disabled={updating}
              >
                <Ionicons name="map" size={20} color={colors.card} />
                <Text style={styles.actionBtnTextPrimary}>Start Journey</Text>
              </TouchableOpacity>
            ))}

          {delivery.status === 'en_route' &&
            (showConfirm === 'pickup' ? (
              <View style={styles.confirmBox}>
                <Text style={styles.confirmTitle}>Confirm arrived and items picked up?</Text>
                <View style={styles.confirmRowBtn}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryConfirmBtn}
                    onPress={() => handleAction('picked_up')}
                    disabled={updating}
                  >
                    <Text style={styles.primaryConfirmBtnText}>Confirm Picked Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionBtnPrimary}
                onPress={() => setShowConfirm('pickup')}
                disabled={updating}
              >
                <Ionicons name="cube" size={20} color={colors.card} />
                <Text style={styles.actionBtnTextPrimary}>Items Picked Up</Text>
              </TouchableOpacity>
            ))}

          {delivery.status === 'picked_up' &&
             <TouchableOpacity
                style={[styles.actionBtnPrimary, { backgroundColor: colors.accent }]}
                onPress={() => handleAction('in_progress')}
                disabled={updating}
             >
                <Ionicons name="bicycle" size={20} color={colors.card} />
                <Text style={styles.actionBtnTextPrimary}>Start Delivery Route</Text>
             </TouchableOpacity>
          }

          {delivery.status === 'in_progress' &&
            (showConfirm === 'deliver' ? (
              <View style={styles.confirmBoxSuccess}>
                <Text style={styles.confirmTitle}>Confirm delivery completed?</Text>
                <View style={styles.confirmRowBtn}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowConfirm(null)}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.successConfirmBtn}
                    onPress={() => handleAction('completed')}
                    disabled={updating}
                  >
                    <Text style={styles.primaryConfirmBtnText}>Confirm Delivery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.actionBtnSuccess}
                onPress={() => setShowConfirm('deliver')}
                disabled={updating}
              >
                <Ionicons name="checkmark-done" size={20} color={colors.card} />
                <Text style={styles.actionBtnTextPrimary}>Complete Delivery</Text>
              </TouchableOpacity>
            ))}

          {delivery.status === 'in_progress' && String(delivery.paymentMethod || '').toUpperCase().includes('CASH') && !delivery.isPaid && (
            <TouchableOpacity 
              style={[styles.actionBtnSuccess, { backgroundColor: '#eab308' }]} 
              onPress={() => {
                Alert.alert('Payment Collected', 'Are you sure you have collected the cash payment?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Yes, Collected',
                    onPress: async () => {
                      try {
                        console.log('[Driver][COD] Collecting payment deliveryId=', delivery.id);
                        await deliveriesApi.collectCodPayment(delivery.id);
                        await loadDelivery();
                        Alert.alert('Success', 'Cash payment marked as collected.');
                      } catch (e) {
                        Alert.alert('Payment Update Failed', e?.message || 'Unable to mark COD as collected.');
                      }
                    },
                  }
                ]);
              }}
            >
              <Ionicons name="cash-outline" size={20} color={colors.card} />
              <Text style={styles.actionBtnTextPrimary}>Collect Cash Payment</Text>
            </TouchableOpacity>
          )}

          {delivery.status === 'in_progress' && (
            <TouchableOpacity 
              style={[styles.simBtn, isSimulating && styles.simBtnActive]} 
              onPress={() => setIsSimulating(!isSimulating)}
            >
              <Ionicons name={isSimulating ? "stop-circle" : "play-circle"} size={20} color={isSimulating ? colors.error : colors.success} />
              <Text style={[styles.simBtnText, isSimulating && { color: colors.error }]}>
                {isSimulating ? (isSimulating ? "Stop Simulation" : "Simulate Movement") : "Simulate Movement"}
              </Text>
            </TouchableOpacity>
          )}

          {delivery.status === 'completed' && (
            <View style={styles.completedBox}>
              <Ionicons name="checkmark" size={20} color={colors.success} />
              <Text style={styles.completedBoxText}>Delivered Successfully</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  errorText: { fontSize: 13, color: colors.error, marginBottom: 16, textAlign: 'center' },

  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { fontSize: 14, fontWeight: '500', color: colors.text, marginLeft: 8 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 4 },
  orderId: { fontSize: 14, color: colors.textSecondary },
  statusLabel: { marginBottom: 24, marginTop: 4, fontSize: 12, fontWeight: '700', color: colors.primary },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
  addressRowBlock: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  copyText: { fontSize: 12, fontWeight: '500', color: colors.primary, marginLeft: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  infoKey: { fontSize: 14, color: colors.textSecondary },
  infoVal: { fontSize: 14, fontWeight: '500', color: colors.text, maxWidth: '60%', textAlign: 'right' },
  contactActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -4,
    marginBottom: 12,
  },
  contactActionBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  contactActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },

  instructionsBox: {
    backgroundColor: 'hsla(16, 100%, 56%, 0.1)',
    borderWidth: 1,
    borderColor: 'hsla(16, 100%, 56%, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  insRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  insTitle: { fontSize: 12, fontWeight: 'bold', color: colors.warning, marginLeft: 6 },
  insBody: { fontSize: 12, color: colors.text },

  timelineCol: { paddingTop: 8 },
  timelineRow: { flexDirection: 'row' },
  timelineIconArea: { width: 24, alignItems: 'center', marginRight: 12 },
  timeDot: { width: 12, height: 12, borderRadius: 6 },
  timeDotActive: { backgroundColor: colors.primary },
  timeDotInactive: { backgroundColor: colors.border },
  timeLine: { width: 2, height: 24 },
  timeLineActive: { backgroundColor: colors.primary },
  timeLineInactive: { backgroundColor: colors.border },
  timelineContent: { paddingBottom: 16 },
  timelineStep: { fontSize: 14, fontWeight: '500' },
  timelineStepActive: { color: colors.text },
  timelineStepInactive: { color: colors.textSecondary },

  proofActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  proofBtn: {
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
  proofBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  proofPreview: {
    marginTop: 8,
  },
  proofLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  proofImage: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    backgroundColor: colors.border,
  },

  actionsBox: { gap: 12 },
  mapBtn: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapBtnText: { color: colors.primary, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  actionBtnPrimary: {
    height: 52,
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnSuccess: {
    height: 52,
    backgroundColor: colors.success,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTextPrimary: { color: colors.card, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

  confirmBox: {
    backgroundColor: 'hsla(16, 100%, 56%, 0.1)',
    borderWidth: 1,
    borderColor: 'hsla(16, 100%, 56%, 0.2)',
    borderRadius: 12,
    padding: 16,
  },
  confirmBoxSuccess: {
    backgroundColor: 'hsla(156, 87%, 34%, 0.1)',
    borderWidth: 1,
    borderColor: 'hsla(156, 87%, 34%, 0.2)',
    borderRadius: 12,
    padding: 16,
  },
  confirmTitle: { fontSize: 14, fontWeight: 'bold', color: colors.text, marginBottom: 12, textAlign: 'center' },
  confirmRowBtn: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: { color: colors.text, fontSize: 14, fontWeight: '500' },
  primaryConfirmBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successConfirmBtn: {
    flex: 1,
    height: 40,
    backgroundColor: colors.success,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryConfirmBtnText: { color: colors.card, fontSize: 14, fontWeight: 'bold' },
  completedBox: {
    height: 52,
    backgroundColor: 'hsla(156, 87%, 34%, 0.1)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedBoxText: { color: colors.success, fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  simBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    marginTop: 8,
  },
  simBtnActive: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  simBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginLeft: 8,
  },
  mapCard: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.92)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.text,
  },
  driverMarker: {
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
});

export default DeliveryDetailScreen;
