import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { profileApi } from '../../services/api';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../../services/storageService';

const EditProfileScreen = ({ navigation }) => {
  const { user, firebaseIdToken, updateUserProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    profileImageUrl: user?.profileImageUrl || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setForm({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      email: user?.email || '',
      profileImageUrl: user?.profileImageUrl || '',
    });
  }, [user?.fullName, user?.phone, user?.email, user?.profileImageUrl]);

  const isBusy = saving || uploadingPhoto;

  const canSave = useMemo(() => {
    return !!form.fullName?.trim() && /^09\d{9}$/.test(form.phone || '');
  }, [form.fullName, form.phone]);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const next = {};
    if (!form.fullName?.trim() || form.fullName.trim().length < 2) {
      next.fullName = 'Name required (min 2 chars)';
    }
    if (!/^09\d{9}$/.test(form.phone || '')) {
      next.phone = 'Valid PH number (09XXXXXXXXX)';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAvatarUpload = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission?.granted) {
        Alert.alert('Permission Required', 'Please allow photo library access to upload a profile image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.85,
      });
      if (result?.canceled || !result?.assets?.length) return;

      setUploadingPhoto(true);
      const selectedAsset = result.assets[0];
      console.log('[Profile][ImageUpload] Selected image for profile edit userId=', user?.id);
      const upload = await uploadImageAsync(selectedAsset.uri, {
        idToken: firebaseIdToken,
        folder: `customers/${user?.id || 'unknown'}/profile-images`,
        fileName: `profile_${Date.now()}.jpg`,
      });

      const nextUrl = upload.downloadURL || selectedAsset.uri;
      setField('profileImageUrl', nextUrl);
      console.log('[Profile][ImageUpload] Upload complete path=', upload.path);
      Alert.alert('Upload Successful', 'Image uploaded. Save profile to apply changes.');
    } catch (error) {
      console.error('[Profile][ImageUpload] Failed in edit profile:', error);
      Alert.alert('Upload Failed', error?.message || 'Unable to upload image right now.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      console.log('[Profile][Save] Saving profile update userId=', user?.id);
      await profileApi.updateProfile({
        fullName: form.fullName.trim(),
        mobileNumber: form.phone.trim(),
        profileImageUrl: form.profileImageUrl || null,
      });
      await updateUserProfile({
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        profileImageUrl: form.profileImageUrl || '',
      });
      console.log('[Profile][Save] Save complete userId=', user?.id);
      Alert.alert('Profile Updated', 'Your profile details were saved successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('[Profile][Save] Save failed:', error);
      Alert.alert('Save Failed', error?.message || 'Unable to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBox}>
            {form.profileImageUrl ? (
              <Image source={{ uri: form.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={64} color={colors.primary} />
            )}
          </View>
          <TouchableOpacity style={styles.cameraBtn} onPress={handleAvatarUpload} disabled={isBusy}>
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.card} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.card} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.fieldBox}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, errors.fullName && styles.inputError]}
              value={form.fullName}
              onChangeText={(t) => setField('fullName', t)}
              placeholder="Your full name"
            />
            {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              style={[styles.input, errors.phone && styles.inputError]}
              value={form.phone}
              onChangeText={(t) => setField('phone', t)}
              keyboardType="phone-pad"
              placeholder="09XXXXXXXXX"
            />
            {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={[styles.input, styles.inputDisabled]} value={form.email} editable={false} />
            <Text style={styles.hintText}>Email cannot be changed here.</Text>
          </View>

          <TouchableOpacity
            style={styles.pwdBtn}
            onPress={() => navigation.navigate('ChangePassword')}
            disabled={isBusy}
          >
            <Text style={styles.pwdBtnText}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveButton, (!canSave || isBusy) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave || isBusy}
          >
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },

  avatarWrap: { alignItems: 'center', marginBottom: 32, marginTop: 12 },
  avatarBox: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'hsla(224, 82%, 48%, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 96,
    height: 96,
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: '35%',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  formContainer: { maxWidth: 400, width: '100%', alignSelf: 'center' },
  fieldBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    fontSize: 14,
    color: colors.text,
  },
  inputError: { borderColor: colors.error },
  inputDisabled: { backgroundColor: colors.border, color: colors.textSecondary },
  errorText: { color: colors.error, fontSize: 12, marginTop: 4 },
  hintText: { color: colors.textSecondary, fontSize: 10, marginTop: 4 },

  pwdBtn: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  pwdBtnText: { color: colors.warning, fontSize: 14, fontWeight: '600' },
  saveButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.card,
    fontSize: 15,
    fontWeight: '700',
  },
});

export default EditProfileScreen;
