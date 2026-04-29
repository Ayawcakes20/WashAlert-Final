import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../theme/colors';

/**
 * Reusable Photo Capture component.
 * 
 * Props:
 *   label: string       - Label for the photo (e.g. "Bags at Counter")
 *   value: string       - Captured photo URI (if any)
 *   onCapture: function - Fired when image is picked
 *   loading: boolean    - If current action is uploading/processing
 *   onError: function   - Fired when capture/pick fails
 */
const PhotoProofCapture = ({ label, value, onCapture, loading = false, onError }) => {
  const [localUri, setLocalUri] = useState(value);

  const reportCaptureError = (message) => {
    const safeMessage = message || 'Unable to capture image. Please try again.';
    onError?.(safeMessage);
    Alert.alert('Photo Capture Failed', safeMessage);
  };

  const validateAsset = (result) => {
    if (result?.canceled) return null;
    const asset = result?.assets?.[0];
    if (!asset?.uri || typeof asset.uri !== 'string') {
      reportCaptureError('Selected image is invalid. Please try again.');
      return null;
    }
    return asset.uri;
  };

  const handleCapture = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        reportCaptureError('Camera access is needed to provide proof of delivery.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      const uri = validateAsset(result);
      if (!uri) return;
      setLocalUri(uri);
      onCapture?.(uri);
    } catch (err) {
      console.warn('[PhotoProofCapture] Camera Error:', err);
      reportCaptureError('Unable to open the camera right now.');
    }
  };

  const handlePickFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        reportCaptureError('Photo library access is needed to upload proof.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });
      const uri = validateAsset(result);
      if (!uri) return;
      setLocalUri(uri);
      onCapture?.(uri);
    } catch (err) {
      console.warn('[PhotoProofCapture] Gallery Error:', err);
      reportCaptureError('Unable to open your photo library right now.');
    }
  };

  const handlePickImage = () => {
    if (loading) return;
    Alert.alert('Proof Photo', 'Choose a photo source', [
      { text: 'Take Photo', onPress: () => { void handleCapture(); } },
      { text: 'Choose from Gallery', onPress: () => { void handlePickFromGallery(); } },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  React.useEffect(() => {
    if (value && value !== localUri) {
      setLocalUri(value);
    }
  }, [value, localUri]);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity 
        style={[styles.box, value || localUri ? styles.boxActive : null]} 
        onPress={handlePickImage}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (value || localUri) ? (
          <View style={styles.previewWrapper}>
            <Image source={{ uri: value || localUri }} style={styles.image} />
            <View style={styles.changeBadge}>
              <Ionicons name="camera" size={12} color="#FFF" />
              <Text style={styles.changeText}>Change</Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.iconCircle}>
              <Ionicons name="camera" size={32} color={colors.primary} />
            </View>
            <Text style={styles.placeholderText}>Tap to Take Photo</Text>
            <Text style={styles.placeholderSubText}>Required for confirmation</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  box: {
    height: 180,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: colors.surfaceVariant + '40',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxActive: {
    borderStyle: 'solid',
    borderColor: colors.primary + '40',
    backgroundColor: '#FFF',
  },
  placeholder: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  placeholderText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  placeholderSubText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  previewWrapper: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});

export default PhotoProofCapture;
