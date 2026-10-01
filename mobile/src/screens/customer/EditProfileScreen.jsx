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
import { getDefaultSavedAddress, saveOrUpdateDefaultAddress } from '../../services/savedAddresses';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../../services/storageService';
import ScrollCue from '../../components/ScrollCue';
import { useScrollCue } from '../../hooks/useScrollCue';

// Same name allowlist as RegisterScreen — letters, spaces, and name punctuation only.
const NAME_DISALLOWED_RE = /[^a-zA-Z\s'.-]/g;
const MAX_LEN = { fullName: 60, phone: 11, address: 160, addressLine1: 100, addressLine2: 100 };

const EditProfileScreen = ({ navigation }) => {
  const { user, firebaseIdToken, updateUserProfile } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'staff';
  const scrollCue = useScrollCue();
  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    profileImageUrl: user?.profileImageUrl || '',
    address: user?.address || '',
    addressLine1: user?.addressLine1 || '',
    addressLine2: user?.addressLine2 || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setForm((prev) => ({
      ...prev,
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      email: user?.email || '',
      profileImageUrl: user?.profileImageUrl || '',
      address: user?.address || prev.address || '',
      addressLine1: user?.addressLine1 || prev.addressLine1 || '',
      addressLine2: user?.addressLine2 || prev.addressLine2 || '',
    }));

    getDefaultSavedAddress()
      .then((def) => {
        if (isMounted && def) {
          setForm((prev) => ({
            ...prev,
            address: user?.address || prev.address || def.address || '',
            addressLine1: user?.addressLine1 || prev.addressLine1 || def.addressLine1 || def.unitFloor || '',
            addressLine2: user?.addressLine2 || prev.addressLine2 || def.addressLine2 || '',
          }));
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.fullName, user?.phone, user?.email, user?.profileImageUrl, user?.address, user?.addressLine1, user?.addressLine2]);

  const isBusy = saving || uploadingPhoto;

  const canSave = useMemo(() => {
    const hasValidNameAndPhone = !!form.fullName?.trim() && /^09\d{9}$/.test(form.phone || '');
    if (isAdminOrStaff && isEditing) {
      return hasValidNameAndPhone && !!form.address?.trim();
    }
    return hasValidNameAndPhone;
  }, [form.fullName, form.phone, form.address, isAdminOrStaff, isEditing]);

  const setField = (key, value) => {
    let next = value;
    if (key === 'fullName') next = value.replace(NAME_DISALLOWED_RE, '');
    if (key === 'phone') next = value.replace(/\D/g, '');
    setForm((prev) => ({ ...prev, [key]: next }));
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
    if (isAdminOrStaff && isEditing) {
      if (!form.address?.trim()) {
        next.address = 'Address is required';
      }
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

      const profileUpdates = {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        profileImageUrl: form.profileImageUrl || '',
      };

      if (isAdminOrStaff) {
        const trimmedAddress = form.address.trim();
        const trimmedLine1 = form.addressLine1?.trim() || '';
        const trimmedLine2 = form.addressLine2?.trim() || '';
        profileUpdates.address = trimmedAddress;
        profileUpdates.addressLine1 = trimmedLine1;
        profileUpdates.addressLine2 = trimmedLine2;

        await saveOrUpdateDefaultAddress({
          label: 'Home',
          address: trimmedAddress,
          addressLine1: trimmedLine1,
          addressLine2: trimmedLine2,
          unitFloor: [trimmedLine1, trimmedLine2].filter(Boolean).join(', '),
          isDefault: true,
        }).catch(() => {});
      }

      await updateUserProfile(profileUpdates);
      console.log('[Profile][Save] Save complete userId=', user?.id);
      setIsEditing(false);
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

  const handleCancelEdit = () => {
    setForm({
      fullName: user?.fullName || '',
      phone: user?.phone || '',
      email: user?.email || '',
      profileImageUrl: user?.profileImageUrl || '',
      address: user?.address || '',
      addressLine1: user?.addressLine1 || '',
      addressLine2: user?.addressLine2 || '',
    });
    getDefaultSavedAddress()
      .then((def) => {
        if (def) {
          setForm((prev) => ({
            ...prev,
            address: user?.address || def.address || '',
            addressLine1: user?.addressLine1 || def.addressLine1 || def.unitFloor || '',
            addressLine2: user?.addressLine2 || def.addressLine2 || '',
          }));
        }
      })
      .catch(() => {});
    setErrors({});
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollCue.onScroll}
        scrollEventThrottle={16}
        onContentSizeChange={scrollCue.onContentSizeChange}
        onLayout={scrollCue.onLayout}
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatarBox}>
            {form.profileImageUrl ? (
              <Image source={{ uri: form.profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person-circle-outline" size={64} color={colors.primary} />
            )}
          </View>
          {isEditing && (
            <TouchableOpacity style={styles.cameraBtn} onPress={handleAvatarUpload} disabled={isBusy}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Ionicons name="camera" size={16} color={colors.card} />
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.formContainer}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle}>Account Information</Text>
            {!isEditing && (
              <TouchableOpacity style={styles.editIconBtn} onPress={() => setIsEditing(true)}>
                <Ionicons name="pencil-outline" size={16} color={colors.primary} />
                <Text style={styles.editIconBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Full Name</Text>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.input, errors.fullName && styles.inputError]}
                  value={form.fullName}
                  onChangeText={(t) => setField('fullName', t)}
                  placeholder="Your full name"
                  maxLength={MAX_LEN.fullName}
                />
                {errors.fullName ? <Text style={styles.errorText}>{errors.fullName}</Text> : null}
              </>
            ) : (
              <Text style={styles.viewValue}>{form.fullName || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Mobile Number</Text>
            {isEditing ? (
              <>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  value={form.phone}
                  onChangeText={(t) => setField('phone', t)}
                  keyboardType="phone-pad"
                  placeholder="09XXXXXXXXX"
                  maxLength={MAX_LEN.phone}
                />
                {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
              </>
            ) : (
              <Text style={styles.viewValue}>{form.phone || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Email</Text>
            {isEditing ? (
              <>
                <TextInput style={[styles.input, styles.inputDisabled]} value={form.email} editable={false} />
                <Text style={styles.hintText}>Email cannot be changed here.</Text>
              </>
            ) : (
              <Text style={styles.viewValue}>{form.email || '—'}</Text>
            )}
          </View>

          {/* Default Address Section */}
          <View style={styles.addressSectionHeader}>
            <View style={styles.addressTitleRow}>
              <Ionicons name="location" size={18} color={colors.primary} />
              <Text style={styles.addressSectionTitle}>Default Address</Text>
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>DEFAULT</Text>
              </View>
            </View>
            {!isAdminOrStaff && (
              <View style={styles.lockRow}>
                <Ionicons name="lock-closed" size={13} color={colors.textTertiary} />
                <Text style={styles.lockNotice}>Only Admin/Staff can edit</Text>
              </View>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Address</Text>
            {isEditing && isAdminOrStaff ? (
              <>
                <TextInput
                  style={[styles.input, errors.address && styles.inputError]}
                  value={form.address}
                  onChangeText={(t) => setField('address', t)}
                  placeholder="Street / Barangay / City"
                  maxLength={MAX_LEN.address}
                />
                {errors.address ? <Text style={styles.errorText}>{errors.address}</Text> : null}
              </>
            ) : isEditing && !isAdminOrStaff ? (
              <>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={form.address}
                  editable={false}
                  placeholder="No address set"
                />
                <Text style={styles.hintText}>Default address can only be changed by Admin or Staff.</Text>
              </>
            ) : (
              <Text style={styles.viewValue}>{form.address || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Address Line 1 (Optional)</Text>
            {isEditing && isAdminOrStaff ? (
              <TextInput
                style={styles.input}
                value={form.addressLine1}
                onChangeText={(t) => setField('addressLine1', t)}
                placeholder="Apt, suite, unit, building"
                maxLength={MAX_LEN.addressLine1}
              />
            ) : isEditing && !isAdminOrStaff ? (
              <>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={form.addressLine1}
                  editable={false}
                  placeholder="—"
                />
                <Text style={styles.hintText}>Default address can only be changed by Admin or Staff.</Text>
              </>
            ) : (
              <Text style={styles.viewValue}>{form.addressLine1 || '—'}</Text>
            )}
          </View>

          <View style={styles.fieldBox}>
            <Text style={styles.label}>Address Line 2 (Optional)</Text>
            {isEditing && isAdminOrStaff ? (
              <TextInput
                style={styles.input}
                value={form.addressLine2}
                onChangeText={(t) => setField('addressLine2', t)}
                placeholder="Landmark, floor, delivery notes"
                maxLength={MAX_LEN.addressLine2}
              />
            ) : isEditing && !isAdminOrStaff ? (
              <>
                <TextInput
                  style={[styles.input, styles.inputDisabled]}
                  value={form.addressLine2}
                  editable={false}
                  placeholder="—"
                />
                <Text style={styles.hintText}>Default address can only be changed by Admin or Staff.</Text>
              </>
            ) : (
              <Text style={styles.viewValue}>{form.addressLine2 || '—'}</Text>
            )}
          </View>

          {isEditing ? (
            <>
              <TouchableOpacity
                style={styles.pwdBtn}
                onPress={() => navigation.navigate('ChangePassword')}
                disabled={isBusy}
              >
                <Text style={styles.pwdBtnText}>Change Password</Text>
              </TouchableOpacity>

              <View style={styles.editActionsRow}>
                <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit} disabled={isBusy}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, styles.saveButtonFlex, (!canSave || isBusy) && styles.saveButtonDisabled]}
                  onPress={handleSave}
                  disabled={!canSave || isBusy}
                >
                  <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity
              style={styles.pwdBtn}
              onPress={() => navigation.navigate('ChangePassword')}
            >
              <Text style={styles.pwdBtnText}>Change Password</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      <ScrollCue visible={scrollCue.showCue} />
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionHeaderTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  editIconBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editIconBtnText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  fieldBox: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 6 },
  viewValue: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    lineHeight: 50,
  },
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

  addressSectionHeader: {
    marginTop: 8,
    marginBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addressTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  defaultBadge: {
    backgroundColor: 'rgba(46, 196, 182, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(46, 196, 182, 0.3)',
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0F766E',
    letterSpacing: 0.5,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  lockNotice: {
    fontSize: 12,
    color: colors.textTertiary,
    fontStyle: 'italic',
  },

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
  editActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  saveButton: {
    marginTop: 20,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonFlex: {
    flex: 1,
    marginTop: 0,
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
