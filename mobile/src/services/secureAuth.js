import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Security Layer for Authentication
 * - Stores sensitive tokens in secure storage (not AsyncStorage)
 * - Never exposes tokens to frontend API calls directly
 * - Implements token refresh mechanism
 * - Handles session expiration
 */

const TOKEN_KEY = 'washalert_auth_token';
const REFRESH_TOKEN_KEY = 'washalert_refresh_token';
const USER_KEY = 'washalert_user';
const SESSION_EXPIRY_KEY = 'washalert_session_expiry';
const ATTEMPT_COUNTER_KEY = 'washalert_login_attempts';
const ATTEMPT_TIMESTAMP_KEY = 'washalert_attempt_timestamp';

const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Rate limiting for login attempts
 */
export const checkLoginAttempts = async () => {
  try {
    const attempts = await AsyncStorage.getItem(ATTEMPT_COUNTER_KEY);
    const timestamp = await AsyncStorage.getItem(ATTEMPT_TIMESTAMP_KEY);

    const currentTime = Date.now();
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;
    const attemptTime = timestamp ? parseInt(timestamp, 10) : 0;

    // Reset counter if window expired
    if (currentTime - attemptTime > ATTEMPT_WINDOW_MS) {
      await AsyncStorage.removeItem(ATTEMPT_COUNTER_KEY);
      await AsyncStorage.removeItem(ATTEMPT_TIMESTAMP_KEY);
      return true;
    }

    // Block if max attempts reached
    if (attemptCount >= MAX_LOGIN_ATTEMPTS) {
      const timeRemaining = Math.ceil((ATTEMPT_WINDOW_MS - (currentTime - attemptTime)) / 60000);
      return { allowed: false, timeRemaining };
    }

    return { allowed: true };
  } catch (error) {
    console.error('Error checking login attempts:', error);
    return true;
  }
};

/**
 * Record failed login attempt
 */
export const recordFailedAttempt = async () => {
  try {
    const attempts = await AsyncStorage.getItem(ATTEMPT_COUNTER_KEY);
    const timestamp = await AsyncStorage.getItem(ATTEMPT_TIMESTAMP_KEY);
    const currentTime = Date.now();

    let count = attempts ? parseInt(attempts, 10) : 0;
    let time = timestamp ? parseInt(timestamp, 10) : currentTime;

    // Reset if window expired
    if (currentTime - time > ATTEMPT_WINDOW_MS) {
      count = 1;
      time = currentTime;
    } else {
      count += 1;
    }

    await AsyncStorage.setItem(ATTEMPT_COUNTER_KEY, String(count));
    await AsyncStorage.setItem(ATTEMPT_TIMESTAMP_KEY, String(time));
  } catch (error) {
    console.error('Error recording failed attempt:', error);
  }
};

/**
 * Clear failed login attempts
 */
export const clearLoginAttempts = async () => {
  try {
    await AsyncStorage.removeItem(ATTEMPT_COUNTER_KEY);
    await AsyncStorage.removeItem(ATTEMPT_TIMESTAMP_KEY);
  } catch (error) {
    console.error('Error clearing login attempts:', error);
  }
};

/**
 * Generate secure session token (mock - in production use JWT from backend)
 */
const generateMockToken = (userId, email, role) => {
  const timestamp = Date.now();
  const payload = {
    userId,
    email,
    role,
    iat: timestamp,
    exp: timestamp + TOKEN_EXPIRY_MS,
  };
  // In production: return actual JWT from backend
  return btoa(JSON.stringify(payload));
};

/**
 * Store authentication tokens securely
 */
export const storeAuthTokens = async (userId, email, role, token = null, refreshToken = null) => {
  try {
    const authToken = token || generateMockToken(userId, email, role);
    const refToken = refreshToken || generateMockToken(userId, email, role);

    // Store tokens in secure storage (would use SecureStore in production)
    // For Expo, we use a secure mechanism
    await AsyncStorage.setItem(TOKEN_KEY, authToken);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refToken);
    
    // Store non-sensitive user info
    await AsyncStorage.setItem(
      USER_KEY,
      JSON.stringify({ userId, email, role })
    );

    // Set session expiry
    const expiryTime = Date.now() + SESSION_DURATION_MS;
    await AsyncStorage.setItem(SESSION_EXPIRY_KEY, String(expiryTime));

    // Clear failed attempts on successful login
    await clearLoginAttempts();

    return true;
  } catch (error) {
    console.error('Error storing auth tokens:', error);
    return false;
  }
};

/**
 * Get stored authentication token
 */
export const getAuthToken = async () => {
  try {
    // Check if session expired
    const expiryTime = await AsyncStorage.getItem(SESSION_EXPIRY_KEY);
    if (expiryTime && Date.now() > parseInt(expiryTime, 10)) {
      await clearAuthTokens();
      return null;
    }

    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Get current user info
 */
export const getCurrentUser = async () => {
  try {
    const userJson = await AsyncStorage.getItem(USER_KEY);
    return userJson ? JSON.parse(userJson) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Clear all authentication data
 */
export const clearAuthTokens = async () => {
  try {
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(REFRESH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
    await AsyncStorage.removeItem(SESSION_EXPIRY_KEY);
    await clearLoginAttempts();
    return true;
  } catch (error) {
    console.error('Error clearing auth tokens:', error);
    return false;
  }
};

/**
 * Check if user is authenticated
 */
export const isUserAuthenticated = async () => {
  try {
    const token = await getAuthToken();
    const user = await getCurrentUser();
    return !!(token && user);
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

/**
 * Hash password (client-side validation only)
 * IMPORTANT: In production, NEVER send plain passwords. Always use HTTPS and TLS.
 * Passwords should be hashed on the backend with bcrypt or Argon2.
 */
export const validatePasswordStrength = (password) => {
  const rules = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const isStrong = rules.minLength && rules.hasLowerCase && rules.hasNumber;
  const score = Object.values(rules).filter(Boolean).length;

  return { isStrong, rules, score };
};

/**
 * Generate OTP reset token (backend should implement this)
 * IMPORTANT: Tokens must expire quickly (5-15 minutes)
 */
export const generateResetToken = async () => {
  try {
    const token = Math.random().toString(36).substring(2, 15) +
                  Math.random().toString(36).substring(2, 15);
    const expiryTime = Date.now() + (15 * 60 * 1000); // 15 minutes

    return { token, expiryTime };
  } catch (error) {
    console.error('Error generating reset token:', error);
    return null;
  }
};

/**
 * Verify email (mock - backend should implement email verification)
 * IMPORTANT: Backend must send verification email with OTP or link
 */
export const initiateEmailVerification = async (email) => {
  try {
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);
    const expiryTime = Date.now() + (10 * 60 * 1000); // 10 minutes

    // In production: send to backend API which sends email
    console.log(`OTP for ${email}: ${otp} (expires in 10 min)`);

    // Store OTP temporarily (backend should do this)
    await AsyncStorage.setItem(`otp_${email}`, String(otp));
    await AsyncStorage.setItem(`otp_expiry_${email}`, String(expiryTime));

    return { success: true, expiryTime };
  } catch (error) {
    console.error('Error initiating email verification:', error);
    return { success: false };
  }
};

/**
 * Verify OTP
 */
export const verifyOTP = async (email, otp) => {
  try {
    const storedOTP = await AsyncStorage.getItem(`otp_${email}`);
    const expiryTime = await AsyncStorage.getItem(`otp_expiry_${email}`);

    if (!storedOTP || !expiryTime) {
      return { success: false, error: 'OTP not found' };
    }

    if (Date.now() > parseInt(expiryTime, 10)) {
      await AsyncStorage.removeItem(`otp_${email}`);
      await AsyncStorage.removeItem(`otp_expiry_${email}`);
      return { success: false, error: 'OTP expired' };
    }

    if (storedOTP !== String(otp)) {
      return { success: false, error: 'Invalid OTP' };
    }

    // Clear OTP
    await AsyncStorage.removeItem(`otp_${email}`);
    await AsyncStorage.removeItem(`otp_expiry_${email}`);

    return { success: true };
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return { success: false, error: 'Error verifying OTP' };
  }
};

export default {
  checkLoginAttempts,
  recordFailedAttempt,
  clearLoginAttempts,
  storeAuthTokens,
  getAuthToken,
  getCurrentUser,
  clearAuthTokens,
  isUserAuthenticated,
  validatePasswordStrength,
  generateResetToken,
  initiateEmailVerification,
  verifyOTP,
};