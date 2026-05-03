import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageAsync } from '../../services/storageService';
import { profileApi } from '../../services/api';

const MENU_GROUPS = [
  {
    title: "Account Settings",
    items: [
      { label: "Personal Information", icon: "person-outline", color: colors.primary, screen: 'EditProfile' },
      { label: "Saved Addresses", icon: "location-outline", color: colors.accent, screen: 'SavedAddresses' },
      { label: "Payment Methods", icon: "card-outline", color: colors.success, screen: 'PaymentMethods' },
    ]
  },
  {
    title: "Activity",
    items: [
      { label: "Booking History", icon: "time-outline", color: colors.primary, screen: 'Orders' },
      { label: "Notifications", icon: "notifications-outline", color: colors.warning, screen: 'Notifications' },
    ]
  },
  {
    title: "Support",
    items: [
      { label: "Help & Support", icon: "help-circle-outline", color: colors.accent, screen: 'Chat' },
      { label: "Terms & Conditions", icon: "document-text-outline", color: colors.textSecondary, screen: 'TermsAndConditions' },
      { label: "Privacy Policy", icon: "shield-checkmark-outline", color: colors.textSecondary, screen: 'PrivacyPolicy' },
    ]
  }
];

const ProfileScreen = ({ navigation }) => {
  const { user, logout, firebaseIdToken, updateUserProfile } = useAuth();
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarUri, setAvatarUri] = useState(user?.profileImageUrl || '');
  const userName = user?.fullName || "User";
  const userEmail = user?.email || "No email on profile";

  useEffect(() => {
    setAvatarUri(user?.profileImageUrl || '');
  }, [user?.profileImageUrl]);

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

      if (result?.canceled || !result?.assets?.length) {
        return;
      }

      setUploadingPhoto(true);
      const selectedAsset = result.assets[0];
      console.log('[Profile][ImageUpload] Uploading selected image for user', user?.id);
      const upload = await uploadImageAsync(selectedAsset.uri, {
        idToken: firebaseIdToken,
        folder: `customers/${user?.id || 'unknown'}/profile-images`,
        fileName: `profile_${Date.now()}.jpg`,
      });

      const nextAvatar = upload.downloadURL || selectedAsset.uri;
      await profileApi.updateProfile({
        fullName: userName,
        mobileNumber: user?.phone || '',
        profileImageUrl: nextAvatar,
      });
      await updateUserProfile({ profileImageUrl: nextAvatar });
      setAvatarUri(nextAvatar);
      console.log('[Profile][ImageUpload] Profile image saved path=', upload.path);
      Alert.alert('Upload Successful', 'Your profile image has been updated.');
    } catch (error) {
      console.error('[StorageUpload] Profile image upload failed:', error);
      Alert.alert('Upload Failed', error?.message || 'Unable to upload image right now.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.headerTitle}>My Profile</Text>

        {/* Profile Header Card */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarGradient}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitial}>{userName.charAt(0)}</Text>
              )}
            </View>
            <TouchableOpacity style={styles.editAvatarBtn} onPress={handleAvatarUpload} disabled={uploadingPhoto}>
              <Ionicons name={uploadingPhoto ? "cloud-upload" : "camera"} size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileEmail}>{userEmail}</Text>
          
          <TouchableOpacity 
            style={styles.editProfileBtn}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>
        {/* Menu Groups */}
        {MENU_GROUPS.map((group, gIdx) => (
          <View key={group.title} style={styles.menuGroup}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            <View style={styles.menuCard}>
              {group.items.map((item, iIdx) => (
                <TouchableOpacity 
                  key={item.label}
                  style={[
                    styles.menuItem,
                    iIdx < group.items.length - 1 && styles.menuItemBorder
                  ]}
                  onPress={() => item.screen && navigation.navigate(item.screen)}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: `${item.color}15` }]}>
                    <Ionicons name={item.icon} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutBtn} onPress={confirmSignOut}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.error} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.footerSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 110 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 24 },
  
  profileHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '800',
    color: '#FFF',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.accent,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  editProfileBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  statsGrid: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  statDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
    alignSelf: 'center',
  },

  menuGroup: {
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textTertiary,
    marginLeft: 8,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  menuLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    backgroundColor: `${colors.error}10`,
    marginTop: 8,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.error,
  },
  footerSpacing: {
    height: 40,
  },
});

export default ProfileScreen;

