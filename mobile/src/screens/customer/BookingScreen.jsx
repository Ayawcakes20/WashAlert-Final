import React, { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { MapView, Marker, PROVIDER_GOOGLE } from '../../components/SafeMap';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import * as WebBrowser from 'expo-web-browser';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { Card, Button } from '../../components';
import { branches, laundry, createOrder, estimatePrice, payments } from '../../services/api';

const { width } = Dimensions.get('window');

const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "1:00 PM - 3:00 PM",
  "3:00 PM - 5:00 PM",
  "5:00 PM - 7:00 PM",
];

const BookingScreen = ({ route, navigation }) => {
  const preSelectedServiceId = route.params?.serviceId;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Data from API
  const [availableBranches, setAvailableBranches] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [availableDetergents, setAvailableDetergents] = useState([]);
  const [availableConditioners, setAvailableConditioners] = useState([]);

  // Form State
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [scheduleDate, setScheduleDate] = useState('Today');
  const [scheduleTime, setScheduleTime] = useState(TIME_SLOTS[0]);
  const [loadKg, setLoadKg] = useState('5');
  const [selectedDetergent, setSelectedDetergent] = useState('None');
  const [selectedConditioner, setSelectedConditioner] = useState('None');
  const [requestDelivery, setRequestDelivery] = useState(false);
  const [isRush, setIsRush] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('gcash');
  const [priceDetails, setPriceDetails] = useState({
    deliveryPrice: 0,
    totalPrice: 0
  });

  const [deliveryCoords, setDeliveryCoords] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    address: ''
  });
  const [mapRegion, setMapRegion] = useState({
    latitude: 14.5995,
    longitude: 120.9842,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  const GOOGLE_MAPS_API_KEY = 'AIzaSyAzAGBAijqpEZki3ZZBYe-9rxtzjF55RSY';

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [branchesRes, servicesRes, prefsRes] = await Promise.all([
        branches.getAll(),
        laundry.getServices(),
        laundry.getPreferences(),
      ]);

      setAvailableBranches(branchesRes.branches || []);
      setAvailableServices(servicesRes.services || []);
      setAvailableDetergents(prefsRes.detergents || []);
      setAvailableConditioners(prefsRes.conditioners || []);

      // Handle pre-selected service from Home screen
      if (preSelectedServiceId) {
        const found = servicesRes.services.find(s => s.id === preSelectedServiceId);
        if (found) setSelectedService(found);
      }
    } catch (error) {
      console.error('Error loading booking data:', error);
      Alert.alert('Error', 'Failed to load services. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedService && loadKg) {
      handleEstimate();
    }
  }, [selectedService, loadKg, isRush, selectedDetergent, selectedConditioner, requestDelivery, selectedBranch]);

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
  };

  const handleEstimate = async () => {
    try {
      let computedDistance = 0;
      if (requestDelivery) {
        if (selectedBranch?.latitude && deliveryCoords?.latitude) {
          computedDistance = getDistanceFromLatLonInKm(
            selectedBranch.latitude,
            selectedBranch.longitude,
            deliveryCoords.latitude,
            deliveryCoords.longitude
          );
        } else {
          computedDistance = selectedBranch?.distance || 0;
        }
      }

      const estimation = await estimatePrice({
        branch: selectedBranch?.name || 'Main',
        serviceName: selectedService?.name,
        weightKg: parseFloat(loadKg) || 0,
        isRush: isRush,
        detergent: selectedDetergent,
        fabcon: selectedConditioner,
        distanceKm: computedDistance
      });
      setPriceDetails({
        ...estimation,
        calculatedDistance: computedDistance
      });
    } catch (error) {
      console.error('Estimation failed:', error);
    }
  };

  const calculateTotal = () => {
    return priceDetails.totalPrice;
  };

  const handleConfirmBooking = async () => {
    setSubmitting(true);
    try {
      const orderData = {
        branchId: selectedBranch.id,
        serviceId: selectedService.id,
        serviceType: selectedService.name,
        scheduleDate: scheduleDate,
        scheduleTime: scheduleTime,
        loadKg: parseFloat(loadKg),
        detergent: selectedDetergent,
        conditioner: selectedConditioner,
        delivery: requestDelivery,
        isRush: isRush,
        instructions: specialInstructions,
        paymentMethod: paymentMethod,
        total: priceDetails.totalPrice,
        serviceName: selectedService.name,
        distanceKm: priceDetails.calculatedDistance || (requestDelivery ? (selectedBranch?.distance || 0) : 0),
        deliveryLatitude: requestDelivery ? deliveryCoords.latitude : null,
        deliveryLongitude: requestDelivery ? deliveryCoords.longitude : null,
        deliveryAddress: requestDelivery ? deliveryCoords.address : null,
        branchLatitude: selectedBranch?.latitude || null,
        branchLongitude: selectedBranch?.longitude || null,
      };

      const result = await createOrder(orderData);
      
      if (paymentMethod === 'gcash') {
        try {
          const checkout = await payments.initiateGcashCheckout(result.trackingNumber);
          if (checkout && checkout.checkout_url) {
            await WebBrowser.openBrowserAsync(checkout.checkout_url);
          } else {
            throw new Error('Failed to generate payment link');
          }
        } catch (payError) {
          console.error('Payment initiation failed:', payError);
          Alert.alert(
            'Payment Error',
            'Booking was created but we could not open the payment gateway. Please go to Orders to pay.',
            [{ text: 'OK', onPress: () => navigation.navigate('Orders') }]
          );
          return;
        }
      }

      Alert.alert(
        'Booking Confirmed!',
        `Your tracking number is ${result.trackingNumber}. You can view the status in the Orders tab.`,
        [{ text: 'View Order', onPress: () => {
          setStep(1);
          navigation.navigate('Orders');
        }}]
      );
    } catch (error) {
      console.error('Booking failed:', error);
      Alert.alert('Error', 'Failed to place booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Allow location access to use this feature.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const newCoords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setDeliveryCoords(prev => ({ ...prev, ...newCoords }));
      setMapRegion(prev => ({ ...prev, ...newCoords }));
    } catch (e) {
      Alert.alert('Error', 'Unable to fetch current location.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading services...</Text>
      </View>
    );
  }

  const renderStepIndicator = () => (
    <View style={styles.indicatorContainer}>
      {['Details', 'Schedule', 'Prefs', 'Pay', 'Confirm'].map((label, i) => (
        <View key={label} style={styles.indicatorItem}>
          <View style={[
            styles.indicatorCircle,
            step >= i + 1 ? styles.indicatorActive : styles.indicatorInactive
          ]}>
            {step > i + 1 ? (
              <Ionicons name="checkmark" size={14} color="#FFF" />
            ) : (
              <Text style={[styles.indicatorText, step >= i + 1 && styles.indicatorTextActive]}>{i + 1}</Text>
            )}
          </View>
          <Text style={[styles.indicatorLabel, step >= i + 1 && styles.indicatorLabelActive]}>{label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>New Booking</Text>
        
        {renderStepIndicator()}

        {/* STEP 1: BRANCH & SERVICE */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Select Branch</Text>
            <View style={styles.branchGrid}>
              {availableBranches.map((branch) => (
                <TouchableOpacity
                  key={branch.id}
                  style={[
                    styles.branchCard,
                    selectedBranch?.id === branch.id && styles.selectedCard
                  ]}
                  onPress={() => setSelectedBranch(branch)}
                >
                  <Ionicons 
                    name="map-marker" 
                    size={20} 
                    color={selectedBranch?.id === branch.id ? colors.primary : colors.textSecondary} 
                  />
                  <View style={styles.branchInfo}>
                    <Text style={styles.branchName}>{branch.name}</Text>
                    <Text style={styles.branchAddress} numberOfLines={1}>{branch.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Service Type</Text>
            <View style={styles.serviceGrid}>
              {availableServices.map((service) => (
                <TouchableOpacity
                  key={service.id}
                  style={[
                    styles.serviceCard,
                    selectedService?.id === service.id && styles.selectedServiceCard
                  ]}
                  onPress={() => setSelectedService(service)}
                >
                  <MaterialCommunityIcons 
                    name={service.icon} 
                    size={28} 
                    color={selectedService?.id === service.id ? colors.white : colors.primary} 
                  />
                  <Text style={[
                    styles.serviceName,
                    selectedService?.id === service.id && styles.selectedCardText
                  ]}>{service.name}</Text>
                  <Text style={[
                    styles.servicePrice,
                    selectedService?.id === service.id && styles.selectedCardPrice
                  ]}>₱{service.price}/kg</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button 
              title="Continue" 
              onPress={() => setStep(2)} 
              disabled={!selectedBranch || !selectedService}
              style={styles.nextButton}
            />
          </View>
        )}

        {/* STEP 2: SELECT SCHEDULE */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Select Date</Text>
            <View style={styles.dateSelector}>
              {['Today', 'Tomorrow', 'Other Day'].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.dateBtn, scheduleDate === d && styles.dateBtnActive]}
                  onPress={() => setScheduleDate(d)}
                >
                  <Text style={[styles.dateBtnText, scheduleDate === d && styles.dateBtnTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Available Time Slots</Text>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeCard, scheduleTime === t && styles.selectedTimeCard]}
                  onPress={() => setScheduleTime(t)}
                >
                  <Ionicons 
                    name="time-outline" 
                    size={20} 
                    color={scheduleTime === t ? colors.primary : colors.textSecondary} 
                  />
                  <Text style={[styles.timeText, scheduleTime === t && styles.selectedTimeText]}>{t}</Text>
                  {scheduleTime === t && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(1)} style={styles.halfButton} />
              <Button title="Continue" onPress={() => setStep(3)} style={styles.halfButton} />
            </View>
          </View>
        )}

        {/* STEP 3: LOAD SIZE & PREFERENCES */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Load Size (kg)</Text>
            <View style={styles.kgInputContainer}>
              <TextInput
                style={styles.kgInput}
                keyboardType="numeric"
                value={loadKg}
                onChangeText={setLoadKg}
                placeholder="0"
              />
              <Text style={styles.kgUnit}>kg</Text>
            </View>
            <Text style={styles.kgTip}>Standard load is 5-8 kg per machine.</Text>

            <Text style={styles.sectionTitle}>Detergent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {availableDetergents.map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.pill, selectedDetergent === d && styles.pillActive]}
                  onPress={() => setSelectedDetergent(d)}
                >
                  <Text style={[styles.pillText, selectedDetergent === d && styles.pillTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Fabric Conditioner</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {availableConditioners.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.pill, selectedConditioner === c && styles.pillActive]}
                  onPress={() => setSelectedConditioner(c)}
                >
                  <Text style={[styles.pillText, selectedConditioner === c && styles.pillTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.deliveryToggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Request Delivery?</Text>
                <Text style={styles.toggleSub}>Flat rate ₱50.00 fee applies.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRequestDelivery(!requestDelivery)}
                style={[styles.toggleSwitch, requestDelivery && styles.toggleSwitchActive]}
              >
                <View style={[styles.toggleCircle, requestDelivery && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.deliveryToggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Rush Service?</Text>
                <Text style={styles.toggleSub}>₱150.00 additional fee applies.</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsRush(!isRush)}
                style={[styles.toggleSwitch, isRush && styles.toggleSwitchActive]}
              >
                <View style={[styles.toggleCircle, isRush && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Special Instructions</Text>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              placeholder="e.g. Separate whites, use delicate mode..."
            />

            {requestDelivery && (
               <View style={styles.addressSection}>
                 <Text style={styles.sectionTitle}>Pin Delivery Location</Text>
                 <Text style={styles.addressTip}>Search for your address or drag the pin to your exact spot.</Text>
                 
                 <GooglePlacesAutocomplete
                    placeholder='Type your neighborhood or street...'
                    onPress={(data, details = null) => {
                      if (details) {
                        const loc = details.geometry.location;
                        const newCoords = {
                          latitude: loc.lat,
                          longitude: loc.lng,
                          address: data.description
                        };
                        setDeliveryCoords(newCoords);
                        setMapRegion(prev => ({
                          ...prev,
                          latitude: loc.lat,
                          longitude: loc.lng,
                        }));
                      }
                    }}
                    query={{
                      key: GOOGLE_MAPS_API_KEY,
                      language: 'en',
                      components: 'country:ph', // Philippines scope
                    }}
                    fetchDetails={true}
                    styles={{
                      container: styles.autocompleteContainer,
                      textInput: styles.autocompleteInput,
                    }}
                    listViewDisplayed="auto"
                 />

                 <TouchableOpacity 
                  style={styles.locationBtn} 
                  onPress={handleUseCurrentLocation}
                 >
                   <Ionicons name="locate" size={18} color={colors.primary} />
                   <Text style={styles.locationBtnText}>Use My Current Location</Text>
                 </TouchableOpacity>

                 <View style={styles.mapPinContainer}>
                   <MapView
                    provider={PROVIDER_GOOGLE}
                    style={styles.minMap}
                    region={mapRegion}
                    onRegionChangeComplete={(region) => setMapRegion(region)}
                   >
                     <Marker
                        coordinate={deliveryCoords}
                        draggable
                        onDragEnd={(e) => setDeliveryCoords(prev => ({
                          ...prev,
                          ...e.nativeEvent.coordinate
                        }))}
                        title="Delivery Spot"
                        description="Drag to fine-tune"
                     />
                   </MapView>
                   <View style={styles.mapOverlayCenter}>
                      <Ionicons name="pin" size={40} color={colors.primary} />
                   </View>
                 </View>
                 <Text style={styles.coordsInfo}>
                    Pos: {deliveryCoords.latitude.toFixed(6)}, {deliveryCoords.longitude.toFixed(6)}
                 </Text>
               </View>
            )}

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(2)} style={styles.halfButton} />
              <Button title="Continue" onPress={() => setStep(4)} style={styles.halfButton} />
            </View>
          </View>
        )}

        {/* STEP 4: PAYMENT METHOD */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Choose Payment Method</Text>
            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === 'gcash' && styles.selectedPaymentCard]}
              onPress={() => setPaymentMethod('gcash')}
            >
              <View style={styles.paymentLeft}>
                <View style={[styles.paymentIconBox, { backgroundColor: '#EBF5FF' }]}>
                  <Ionicons name="card-outline" size={24} color="#1D4ED8" />
                </View>
                <View>
                  <Text style={styles.paymentName}>GCash</Text>
                  <Text style={styles.paymentDesc}>Pay instantly with GCash</Text>
                </View>
              </View>
              {paymentMethod === 'gcash' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentCard, paymentMethod === 'cash' && styles.selectedPaymentCard]}
              onPress={() => setPaymentMethod('cash')}
            >
              <View style={styles.paymentLeft}>
                <View style={[styles.paymentIconBox, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="cash-outline" size={24} color="#15803D" />
                </View>
                <View>
                  <Text style={styles.paymentName}>Cash on Pickup</Text>
                  <Text style={styles.paymentDesc}>Pay at the branch counter</Text>
                </View>
              </View>
              {paymentMethod === 'cash' && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(3)} style={styles.halfButton} />
              <Button title="Review Order" onPress={() => setStep(5)} style={styles.halfButton} />
            </View>
          </View>
        )}

        {/* STEP 5: REVIEW & CONFIRM */}
        {step === 5 && (
          <View style={styles.stepContent}>
            <Card style={styles.receiptCard}>
              <Text style={styles.receiptHeader}>Order Summary</Text>
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Branch</Text>
                <Text style={styles.receiptValue}>{selectedBranch?.name}</Text>
              </View>
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Service</Text>
                <Text style={styles.receiptValue}>{selectedService?.name}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Schedule</Text>
                <Text style={styles.receiptValue}>{scheduleDate} | {scheduleTime}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Load Size</Text>
                <Text style={styles.receiptValue}>{loadKg} kg</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Preferences</Text>
                <Text style={styles.receiptValue}>{selectedDetergent}, {selectedConditioner}</Text>
              </View>

              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Service Fee</Text>
                <Text style={styles.receiptValue}>₱{priceDetails.servicePrice?.toFixed(2)}</Text>
              </View>

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Supplies</Text>
                <Text style={styles.receiptValue}>₱{priceDetails.suppliesPrice?.toFixed(2)}</Text>
              </View>

              {requestDelivery && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Delivery Fee</Text>
                  <Text style={styles.receiptValue}>₱{priceDetails.deliveryPrice?.toFixed(2)}</Text>
                </View>
              )}

              <View style={styles.receiptDivider} />

              <View style={styles.receiptTotalRow}>
                <Text style={styles.totalLabel}>Grand Total</Text>
                <Text style={styles.totalValue}>₱{calculateTotal().toFixed(2)}</Text>
              </View>

              <View style={styles.paymentInfoRow}>
                <Text style={styles.payInfoLabel}>Payment Method:</Text>
                <Text style={styles.payInfoValue}>{paymentMethod === 'gcash' ? 'GCash' : 'Cash'}</Text>
              </View>
            </Card>

            <View style={styles.buttonRow}>
              <Button title="Back" variant="ghost" onPress={() => setStep(4)} style={styles.halfButton} />
              <Button 
                title={submitting ? "Processing..." : "Place Booking"} 
                onPress={handleConfirmBooking} 
                disabled={submitting}
                style={styles.halfButton} 
              />
            </View>
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 24,
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 4,
  },
  indicatorItem: {
    alignItems: 'center',
    flex: 1,
  },
  indicatorCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  indicatorActive: {
    backgroundColor: colors.primary,
  },
  indicatorInactive: {
    backgroundColor: colors.border,
  },
  indicatorText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  indicatorTextActive: {
    color: '#FFF',
  },
  indicatorLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: colors.textTertiary,
  },
  indicatorLabelActive: {
    color: colors.primary,
  },
  stepContent: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 16,
    marginBottom: 12,
  },
  branchGrid: {
    gap: 12,
  },
  branchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(26, 86, 219, 0.04)',
    borderWidth: 1.5,
  },
  branchInfo: {
    marginLeft: 12,
    flex: 1,
  },
  branchName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  branchAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceCard: {
    width: (width - 52) / 2,
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  selectedServiceCard: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  servicePrice: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.accent,
  },
  selectedCardText: {
    color: '#FFF',
  },
  selectedCardPrice: {
    color: colors.accentLight,
  },
  dateSelector: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  dateBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dateBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  dateBtnTextActive: {
    color: '#FFF',
  },
  timeGrid: {
    gap: 12,
  },
  timeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedTimeCard: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(26, 86, 219, 0.02)',
  },
  timeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  selectedTimeText: {
    color: colors.text,
    fontWeight: '700',
  },
  nextButton: {
    marginTop: 32,
  },
  kgInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 20,
    height: 60,
  },
  kgInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  kgUnit: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textTertiary,
  },
  kgTip: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  pillScroll: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 10,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: '#FFF',
  },
  deliveryToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(22, 189, 202, 0.05)',
    padding: 20,
    borderRadius: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(22, 189, 202, 0.2)',
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  toggleSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addressSection: {
    marginTop: 24,
    gap: 12,
  },
  addressTip: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  autocompleteContainer: {
    flex: 0,
    zIndex: 10,
  },
  autocompleteInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  locationBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  mapPinContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  minMap: {
    flex: 1,
  },
  mapOverlayCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -40,
    pointerEvents: 'none',
  },
  coordsInfo: {
    fontSize: 11,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  toggleSwitch: {
    width: 52,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.border,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: colors.accent,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF',
  },
  toggleCircleActive: {
    transform: [{ translateX: 22 }],
  },
  textArea: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    height: 100,
    fontSize: 14,
    color: colors.text,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 32,
  },
  halfButton: {
    flex: 1,
  },
  paymentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 16,
  },
  selectedPaymentCard: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(26, 86, 219, 0.02)',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  paymentIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  paymentDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  receiptCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  receiptHeader: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  receiptLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  receiptValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '60%',
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 16,
    borderStyle: 'dashed',
    borderRadius: 1,
  },
  receiptTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  totalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.primary,
  },
  paymentInfoRow: {
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  payInfoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  payInfoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});

export default BookingScreen;