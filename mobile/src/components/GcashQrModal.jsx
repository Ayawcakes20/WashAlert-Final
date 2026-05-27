import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Alert, Image, ScrollView, TextInput, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../services/storageService';
import { payments } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/colors';

const { width: SW } = Dimensions.get('window');

const fmt = (n) => `\u20b1${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function GcashQrModal({ visible, order, branchPhone, onClose, onPaymentSubmitted }) {
  const { firebaseIdToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [screenshotUri, setScreenshotUri] = useState(null);
  const [uploadedProofUrl, setUploadedProofUrl] = useState(null);

  const amountToPay = order?.finalPrice ?? order?.amount ?? order?.totalPrice ?? 0;
  const trackingNumber = order?.trackingNumber || order?.orderId || '';

  const handleSelectImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Required', 'Please allow photo library access to upload a payment receipt.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setLoading(true);
        try {
          // 1. Upload receipt to Firebase Storage immediately
          const uploadResult = await uploadImageAsync(uri, {
            idToken: firebaseIdToken,
            folder: 'payments',
          });
          const proofUrl = uploadResult.downloadURL;

          // 2. Validate receipt on the backend using Gemini
          const valResult = await payments.validateReceipt(proofUrl);

          // Validation succeeded
          setScreenshotUri(uri);
          setUploadedProofUrl(proofUrl);

          if (valResult && valResult.referenceNumber) {
            setReferenceNumber(valResult.referenceNumber);
            Alert.alert(
              'Receipt Verified!',
              `GCash receipt verified successfully. We have auto-filled the Reference Number (${valResult.referenceNumber}) for you.`
            );
          } else {
            Alert.alert(
              'Receipt Attached',
              'GCash receipt attached successfully. Please enter the 13-digit Reference Number manually.'
            );
          }
        } catch (valErr) {
          console.warn('[GcashQrModal] Receipt validation failed:', valErr);
          Alert.alert(
            'Invalid Receipt',
            valErr.message || 'The selected image is not a valid GCash receipt screenshot. Please select a genuine GCash receipt.'
          );
          setScreenshotUri(null);
          setUploadedProofUrl(null);
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      console.warn('[GcashQrModal] Image selection failed:', err);
      Alert.alert('Error', 'Unable to select image.');
    }
  };

  const handleSubmitProof = async () => {
    const trimmedRef = referenceNumber.trim();
    if (!trimmedRef) {
      Alert.alert('Reference Required', 'Please enter your GCash Reference Number.');
      return;
    }
    if (trimmedRef.length !== 13 || !/^\d+$/.test(trimmedRef)) {
      Alert.alert('Invalid Reference Number', 'GCash Reference Number must be exactly 13 digits.');
      return;
    }
    if (!screenshotUri) {
      Alert.alert('Receipt Screenshot Required', 'Please upload a screenshot of your successful GCash transaction.');
      return;
    }

    setLoading(true);
    try {
      // Use pre-uploaded & validated proof URL, fallback to upload if missing
      let proofUrl = uploadedProofUrl;
      if (!proofUrl) {
        try {
          const uploadResult = await uploadImageAsync(screenshotUri, {
            idToken: firebaseIdToken,
            folder: 'payments',
          });
          proofUrl = uploadResult.downloadURL;
        } catch (uploadErr) {
          throw new Error(`Receipt upload failed: ${uploadErr.message}`);
        }
      }

      if (!proofUrl) {
        throw new Error('Could not retrieve uploaded screenshot link.');
      }

      // 2. Submit payment proof record to the backend
      await payments.submitProof({
        trackingNumber,
        method: 'GCash',
        amount: amountToPay,
        referenceNumber: referenceNumber.trim(),
        proofUrl,
      });

      Alert.alert(
        'Proof Submitted!',
        'Your GCash payment proof has been sent to our staff for manual verification. We will notify you once approved.',
        [{
          text: 'OK', onPress: () => {
            onPaymentSubmitted?.();
            handleClose();
          }
        }]
      );
    } catch (err) {
      console.error('[GcashQrModal] Proof submission failed:', err);
      Alert.alert('Submission Failed', err.message || 'Unable to submit payment proof.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReferenceNumber('');
    setScreenshotUri(null);
    setUploadedProofUrl(null);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={handleClose}>
      <View style={S.overlay}>
        <View style={S.card}>
          {/* Header */}
          <View style={S.header}>
            <Text style={S.title}>GCash Transfer</Text>
            <TouchableOpacity onPress={handleClose} disabled={loading} style={S.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={S.scroll} contentContainerStyle={S.scrollContent} showsVerticalScrollIndicator={false} bounces={false}>
            {/* Amount display */}
            <View style={S.amountBox}>
              <Text style={S.amountLabel}>AMOUNT TO PAY</Text>
              <Text style={S.amountVal}>{fmt(amountToPay)}</Text>
            </View>

            {/* QR Code Container */}
            <View style={S.qrContainer}>
              <Text style={S.qrLabel}>Scan QR to Pay</Text>
              <Image
                source={require('../../assets/images/gcash_qr.png')}
                style={S.qrImage}
                resizeMode="contain"
              />
              <Text style={S.qrAcctName}>Account: PR***E LE****D AN**N V.</Text>
              <Text style={S.qrAcctNumber}>GCash No: +63 926 657 1915</Text>
            </View>

            {/* Instructions */}
            <View style={S.instructionsCard}>
              <Text style={S.instructionsTitle}>Instructions:</Text>
              <Text style={S.instructionText}>1. Scan the QR code or send GCash transfer to the number above.</Text>
              <Text style={S.instructionText}>2. Take a screenshot of the GCash receipt.</Text>
              <Text style={S.instructionText}>3. Enter the 13-digit Reference Number and upload the receipt screenshot below.</Text>
              {branchPhone ? (
                <Text style={[S.instructionText, { fontWeight: 'bold', color: colors.primary, marginTop: 4 }]}>
                  *For help, contact branch at: {branchPhone}
                </Text>
              ) : null}
            </View>

            {/* Form Fields */}
            <View style={S.form}>
              <Text style={S.fieldLabel}>GCash Reference Number (13 digits)</Text>
              <TextInput
                style={S.textInput}
                keyboardType="numeric"
                maxLength={13}
                placeholder="e.g. 5013749285918"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                editable={!loading}
              />

              <Text style={S.fieldLabel}>Receipt Screenshot</Text>
              <TouchableOpacity
                style={[S.uploadBtn, screenshotUri && { borderColor: colors.success, backgroundColor: '#F0FDF4' }]}
                onPress={handleSelectImage}
                disabled={loading}
              >
                {loading && !screenshotUri ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Ionicons
                    name={screenshotUri ? 'checkmark-circle' : 'cloud-upload-outline'}
                    size={20}
                    color={screenshotUri ? colors.success : colors.primary}
                  />
                )}
                <Text style={[S.uploadBtnTxt, screenshotUri && { color: colors.success }]}>
                  {loading && !screenshotUri ? 'Uploading & Validating...' : screenshotUri ? 'Receipt Selected (Tap to Change)' : 'Choose Screenshot from Gallery'}
                </Text>
              </TouchableOpacity>

              {screenshotUri && (
                <Image source={{ uri: screenshotUri }} style={S.previewImg} resizeMode="contain" />
              )}
            </View>

            {/* Action buttons */}
            <View style={S.footer}>
              <TouchableOpacity
                style={[S.submitBtn, loading && { opacity: 0.6 }]}
                onPress={handleSubmitProof}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={S.submitBtnTxt}>Submit Payment Reference</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const S = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 24, width: '100%', maxHeight: '85%', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  closeBtn: { padding: 4 },
  scroll: { flexGrow: 0 },
  scrollContent: { padding: 20 },
  amountBox: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, alignItems: 'center', borderStyle: 'solid', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  amountLabel: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.8 },
  amountVal: { fontSize: 26, fontWeight: '900', color: colors.primary, marginTop: 4 },
  qrContainer: { alignItems: 'center', marginBottom: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 16 },
  qrLabel: { fontSize: 14, fontWeight: '800', color: colors.text, marginBottom: 8 },
  qrImage: { width: SW * 0.65, height: SW * 0.65, marginBottom: 10 },
  qrAcctName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  qrAcctNumber: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  instructionsCard: { backgroundColor: '#EFF6FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 16 },
  instructionsTitle: { fontSize: 13, fontWeight: '800', color: '#1E40AF', marginBottom: 6 },
  instructionText: { fontSize: 12, color: '#1E3A8A', lineHeight: 18, marginBottom: 4 },
  form: { gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: colors.text, marginTop: 6 },
  textInput: { height: 48, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, fontSize: 14, color: colors.text, backgroundColor: '#F8FAFC' },
  uploadBtn: { height: 48, borderWidth: 1.5, borderColor: colors.primary, borderStyle: 'dashed', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14, backgroundColor: '#F4F7FF' },
  uploadBtnTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  previewImg: { width: '100%', height: 160, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  footer: { marginTop: 20 },
  submitBtn: { height: 50, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  submitBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
