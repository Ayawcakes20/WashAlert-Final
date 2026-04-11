import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { WashingMachineLoader } from '../../components';

const RegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validateField = (key, value) => {
    const e = { ...errors };
    if (key === 'fullName') {
      if (!value || value.length < 2) e.fullName = 'Full name required (min 2 chars)';
      else delete e.fullName;
    }
    if (key === 'email') {
      if (!value || !/\S+@\S+\.\S+/.test(value)) e.email = 'Valid email required';
      else delete e.email;
    }
    if (key === 'phone') {
      if (!value || !/^09\d{9}$/.test(value)) e.phone = 'Valid PH number (09XXXXXXXXX)';
      else delete e.phone;
    }
    if (key === 'password') {
      if (!value || value.length < 8) e.password = 'Min 8 characters';
      else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(value)) e.password = 'Must contain letter and number';
      else delete e.password;
    }
    if (key === 'confirm') {
      if (value !== form.password) e.confirm = "Passwords don't match";
      else delete e.confirm;
    }
    setErrors(e);
  };

  const set = (key, value) => {
    setForm(p => ({ ...p, [key]: value }));
    validateField(key, value);
  };

  const validate = () => {
    const e = {};
    if (!form.fullName || form.fullName.length < 2) e.fullName = 'Full name required (min 2 chars)';
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Valid email required';
    if (!form.phone || !/^09\d{9}$/.test(form.phone)) e.phone = 'Valid PH number (09XXXXXXXXX)';
    if (!form.password || form.password.length < 8) e.password = 'Min 8 characters';
    else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(form.password)) e.password = 'Must contain letter and number';
    if (form.confirm !== form.password) e.confirm = "Passwords don't match";
    if (!agreed) e.terms = 'Please agree to terms';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;

    const normalizedEmail = (form.email || '').trim().toLowerCase();
    setLoading(true);
    const result = await register({ ...form, email: normalizedEmail });
    setLoading(false);

    if (!result?.success) {
      const errorMessage = result?.error || 'Please try again.';
      const canProceedToVerification = /Account created/i.test(errorMessage);

      if (canProceedToVerification) {
        Alert.alert(
          'Verification Email Not Sent',
          `${errorMessage}\n\nYou can continue to the verification screen and tap "Resend Code".`,
          [
            { text: 'Stay Here', style: 'cancel' },
            {
              text: 'Continue to Verify',
              onPress: () => navigation.navigate('OTPVerification', { email: normalizedEmail, type: 'registration' }),
            },
          ]
        );
        return;
      }

      Alert.alert('Registration Failed', errorMessage);
      return;
    }

    Alert.alert(
      'Account Created',
      `A 6-digit verification code has been sent to ${normalizedEmail}.\n\nCheck your inbox (and spam folder). If you don't receive it within a minute, tap "Resend Code" on the next screen.`,
      [
        {
          text: 'Continue to Verify',
          onPress: () => navigation.navigate('OTPVerification', { email: normalizedEmail, type: 'registration' }),
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <WashingMachineLoader size={120} />
        <Text style={styles.loadingText}>Creating account...</Text>
      </SafeAreaView>
    );
  }

  const inputFields = [
    { key: 'fullName', icon: 'person-outline', placeholder: 'Full Name', keyboardType: 'default' },
    { key: 'email', icon: 'mail-outline', placeholder: 'Email address', keyboardType: 'email-address' },
    { key: 'phone', icon: 'call-outline', placeholder: 'Phone (09XXXXXXXXX)', keyboardType: 'phone-pad' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Header */}
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join WashAlert today</Text>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {inputFields.map(({ key, icon, placeholder, keyboardType }) => (
              <View key={key} style={styles.inputWrapper}>
                <View style={[
                  styles.inputContainer,
                  errors[key] ? styles.inputError : null,
                ]}>
                  <Ionicons name={icon} size={20} color={colors.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textSecondary}
                    value={form[key]}
                    onChangeText={(val) => set(key, val)}
                    keyboardType={keyboardType}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                  />
                </View>
                {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
              </View>
            ))}

            {/* Password */}
            <View style={styles.inputWrapper}>
              <View style={[
                styles.inputContainer,
                errors.password ? styles.inputError : null,
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={colors.textSecondary}
                  value={form.password}
                  onChangeText={(val) => set('password', val)}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)}>
                  <Ionicons
                    name={showPw ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.inputWrapper}>
              <View style={[
                styles.inputContainer,
                errors.confirm ? styles.inputError : null,
              ]}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.input}
                  placeholder="Confirm Password"
                  placeholderTextColor={colors.textSecondary}
                  value={form.confirm}
                  onChangeText={(val) => set('confirm', val)}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
              {errors.confirm ? <Text style={styles.errorText}>{errors.confirm}</Text> : null}
            </View>

            {/* Terms Checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => { setAgreed(!agreed); setErrors(p => ({ ...p, terms: '' })); }}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.termsLink}>Terms & Conditions</Text> and{' '}
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}

            {/* Register Button */}
            <TouchableOpacity
              style={styles.registerButton}
              onPress={handleRegister}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>Register</Text>
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  backButton: {
    marginBottom: 24,
    width: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  formSection: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    padding: 0,
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 4,
    marginBottom: 4,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '500',
  },
  registerButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  loginText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default RegisterScreen;

