import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const ChangePasswordScreen = ({ navigation, route }) => {
  const { changePassword } = useAuth();
  const forcePasswordUpdate = Boolean(route?.params?.forcePasswordUpdate);
  const securityMessage = route?.params?.securityMessage
    || 'For your security, please create a new password before continuing.';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validate = () => {
    if (!currentPassword) {
      return 'Current password is required.';
    }
    if (!newPassword) {
      return 'New password is required.';
    }
    if (!confirmPassword) {
      return 'Confirm password is required.';
    }
    if (newPassword.length < 8) {
      return 'New password must be at least 8 characters.';
    }
    if (!/^(?=.*[A-Za-z])(?=.*\d).+$/.test(newPassword)) {
      return 'New password must include at least one letter and one number.';
    }
    if (newPassword !== confirmPassword) {
      return 'New password and confirm password do not match.';
    }
    if (newPassword === currentPassword) {
      return 'New password must be different from current password.';
    }
    return '';
  };

  const handleSubmit = async () => {
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      Alert.alert('Validation Error', validationMessage);
      return;
    }
    setError('');
    setSaving(true);
    try {
      console.log('[Profile][Password] Attempting password change with Firebase reauthentication');
      const result = await changePassword({ currentPassword, newPassword, forcePasswordUpdate });
      if (!result?.success) {
        throw new Error(result?.error || 'Unable to change password.');
      }
      if (result.autoLogin) {
        Alert.alert('Password Updated', 'Password updated successfully. Redirecting to dashboard.');
        return;
      }
      Alert.alert('Password Updated', 'Your password has been changed successfully.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e) {
      console.error('[Profile][Password] Password change failed:', e);
      setError(e?.message || 'Unable to change password right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.description}>
          {forcePasswordUpdate
            ? securityMessage
            : 'For security, please confirm your current password before setting a new one.'}
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              secureTextEntry={!showCurrentPassword}
              style={styles.input}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowCurrentPassword((prev) => !prev)}>
              <Ionicons name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              secureTextEntry={!showNewPassword}
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPassword((prev) => !prev)}>
              <Ionicons name={showNewPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={styles.inputRow}>
            <TextInput
              secureTextEntry={!showConfirmPassword}
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword((prev) => !prev)}>
              <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={[styles.button, saving && styles.buttonDisabled]} onPress={handleSubmit} disabled={saving}>
          <Text style={styles.buttonText}>{saving ? 'Updating...' : 'Update Password'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 },
  description: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 20 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.text,
  },
  eyeBtn: {
    padding: 4,
  },
  error: { marginTop: 6, color: colors.error, fontSize: 12 },
  button: {
    marginTop: 18,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.card, fontSize: 14, fontWeight: '700' },
});

export default ChangePasswordScreen;
