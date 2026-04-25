import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { colors } from '../../theme/colors';
import { WashingMachineLoader } from '../../components';

const LoginScreen = ({ navigation }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const validateField = (key, value) => {
    const e = { ...errors };
    if (key === 'email') {
      if (!value) e.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(value)) e.email = 'Invalid email format';
      else delete e.email;
    }
    if (key === 'password') {
      if (!value) e.password = 'Password is required';
      else if (value.length < 8) e.password = 'Minimum 8 characters';
      else delete e.password;
    }
    setErrors(e);
  };

  const validate = () => {
    const e = {};
    if (!email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Invalid email format';
    if (!password) e.password = 'Password is required';
    else if (password.length < 8) e.password = 'Minimum 8 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result?.success) {
      Alert.alert('Login Failed', result?.error || 'Unable to login right now.');
      return;
    }
    if (result.requiresOtp) {
      navigation.navigate('OTPVerification', {
        email: email.trim().toLowerCase(),
        type: 'login_otp',
      });
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <WashingMachineLoader size={80} />
        <Text style={styles.loadingText}>Logging in...</Text>
      </View>
    );
  }

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
          {/* ── Brand Header ──────────────────────────────────────────────── */}
          <View style={styles.brandHeader}>
            <View style={styles.logoBox}>
              <Image
                source={require('../../../assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandName}>WashAlert</Text>
            <Text style={styles.brandSub}>Your Laundry, Our Priority</Text>
          </View>

          {/* ── Form ──────────────────────────────────────────────────────── */}
          <View style={styles.formSection}>
            <Text style={styles.formTitle}>Welcome back</Text>
            <Text style={styles.formSub}>Sign in to your account to continue</Text>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={[
                styles.inputRow,
                focusedField === 'email' && styles.inputRowFocused,
                errors.email && styles.inputRowError,
              ]}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={focusedField === 'email' ? colors.primary : colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textTertiary}
                  value={email}
                  onChangeText={(val) => { setEmail(val); validateField('email', val); }}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[
                styles.inputRow,
                focusedField === 'password' && styles.inputRowFocused,
                errors.password && styles.inputRowError,
              ]}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={focusedField === 'password' ? colors.primary : colors.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Min. 8 characters"
                  placeholderTextColor={colors.textTertiary}
                  value={password}
                  onChangeText={(val) => { setPassword(val); validateField('password', val); }}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textTertiary}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Forgot */}
            <TouchableOpacity
              style={styles.forgotWrapper}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Login CTA */}
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={handleLogin}
              activeOpacity={0.85}
            >
              <Text style={styles.loginBtnText}>Log In</Text>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register */}
            <TouchableOpacity
              style={styles.registerBtn}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
            >
              <Text style={styles.registerBtnText}>Create an Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },

  loadingContainer: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Brand header — navy block at top
  brandHeader: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  logo: { width: 56, height: 56, borderRadius: 14 },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  brandSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
  },

  // Form section
  formSection: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -20,
    paddingHorizontal: 24,
    paddingTop: 32,
    flex: 1,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  formSub: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 28,
  },

  // Fields
  fieldGroup: { marginBottom: 18 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceVariant,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputRowFocused: {
    borderColor: colors.primary,
    backgroundColor: '#EAF0F8',
  },
  inputRowError: { borderColor: colors.error },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  eyeBtn: { padding: 4 },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 5,
    marginLeft: 2,
  },

  forgotWrapper: { alignSelf: 'flex-end', marginBottom: 24 },
  forgotText: { fontSize: 13, fontWeight: '600', color: colors.accent },

  // Buttons
  loginBtn: {
    height: 54,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: { fontSize: 12, color: colors.textTertiary },

  registerBtn: {
    height: 54,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});

export default LoginScreen;
