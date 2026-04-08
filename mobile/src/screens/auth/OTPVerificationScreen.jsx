import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const OTPVerificationScreen = ({ navigation, route }) => {
  const { verifyOTP, verifyResetOTP, requestOTP, requestResetOTP } = useAuth();
  const email = route?.params?.email || 'user@example.com';
  const type = route?.params?.type || 'registration';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);
  const refs = useRef([]);

  useEffect(() => {
    if (timer > 0) {
      const id = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(id);
    }
  }, [timer]);

  // Auto-submit when all 6 digits are filled
  useEffect(() => {
    if (otp.every(d => d !== '') && !loading) {
      handleVerify();
    }
  }, [otp]);

  const masked = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
  const isFilled = otp.every((d) => d !== '');

  const handleChange = (idx, val) => {
    if (!/^\d*$/.test(val)) return;
    const next = [...otp];
    next[idx] = val.slice(-1);
    setOtp(next);
    if (val && idx < 5) {
      refs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (idx, key) => {
    if (key === 'Backspace' && !otp[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (val) => {
    const cleaned = val.replace(/[^\d]/g, '').slice(0, 6);
    if (!cleaned) return;
    const next = [...otp];
    cleaned.split('').forEach((char, i) => {
      if (i < 6) next[i] = char;
    });
    setOtp(next);
    // Focus last or next empty
    const nextIdx = Math.min(cleaned.length, 5);
    refs.current[nextIdx]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) return;
    setLoading(true);

    let result;
    if (type === 'password_reset') {
      result = await verifyResetOTP(email, code);
    } else {
      result = await verifyOTP(code, email);
    }

    setLoading(false);
    if (!result?.success) {
      Alert.alert('Verification Failed', result?.error || 'Invalid OTP.');
      setOtp(['', '', '', '', '', '']);
      refs.current[0]?.focus();
      return;
    }

    // If auto-logged in by context, the app will navigate automatically.
    // However, if we're still here, we handle the registration redirect.
    if (result.autoLogin) {
      // Transition is handled by AuthContext (root navigator switch)
      return;
    }

    if (type === 'registration') {
      Alert.alert('Success', 'Account activated! You can now log in.', [
        { text: 'Login', onPress: () => navigation.navigate('Login') },
      ]);
    } else {
      navigation.navigate('ResetPassword', { email, code });
    }
  };

  const handleResend = async () => {
    setLoading(true);
    let result;
    if (type === 'password_reset') {
      result = await requestResetOTP(email);
    } else {
      result = await requestOTP(email);
    }
    setLoading(false);
    if (result.success) {
      setTimer(60);
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } else {
      Alert.alert('Error', result.error || 'Could not resend code.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>Verify Your Email</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code sent to{' '}
          <Text style={styles.emailHighlight}>{masked}</Text>
        </Text>

        {/* OTP Inputs */}
        <View style={styles.otpRow}>
          {otp.map((digit, i) => (
            <TextInput
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              style={[
                styles.otpInput,
                digit ? styles.otpFilled : styles.otpEmpty,
              ]}
              value={digit}
              onChangeText={(val) => handleChange(i, val)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyButton, (!isFilled || loading) && styles.verifyButtonDisabled]}
          onPress={handleVerify}
          disabled={!isFilled || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.verifyButtonText}>
            {loading ? 'Verifying...' : 'Verify'}
          </Text>
        </TouchableOpacity>

        {/* Resend Timer */}
        <View style={styles.resendRow}>
          {timer > 0 ? (
            <Text style={styles.resendText}>
              Resend code in <Text style={styles.timerText}>{timer}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={loading}>
              <Text style={styles.resendLink}>Resend Code</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
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
    marginBottom: 32,
    lineHeight: 20,
  },
  emailHighlight: {
    fontWeight: '500',
    color: colors.text,
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 32,
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 20,
    fontWeight: '700',
    backgroundColor: colors.surface,
    color: colors.text,
  },
  otpFilled: {
    borderColor: colors.success,
  },
  otpEmpty: {
    borderColor: colors.border,
  },
  verifyButton: {
    backgroundColor: colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  verifyButtonDisabled: {
    opacity: 0.5,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  resendRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  resendText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timerText: {
    fontWeight: '500',
    color: colors.text,
  },
  resendLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default OTPVerificationScreen;
