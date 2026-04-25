import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
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
 */
const PhotoProofCapture = ({ label, value, onCapture, loading = false }) => {
  const [localUri, setLocalUri] = useState(value);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission Denied: Camera access is needed to provide proof of delivery.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.7,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setLocalUri(uri);
        onCapture?.(uri);
      }
    } catch (err) {
      console.warn('Camera Error:', err);
    }
  };

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
