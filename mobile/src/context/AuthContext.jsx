import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, FIREBASE_API_KEY } from '../config/env';

const AuthContext = createContext(undefined);

const USER_STORAGE_KEY = 'userData';
const FIREBASE_SESSION_STORAGE_KEY = 'firebaseSessionData';
const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const looksLikeHtml = (value) => /<!doctype html|<html[\s>]/i.test(String(value || ''));

const invalidApiResponseError = () =>
  new Error(
    `Unexpected non-JSON response from auth API (${API_BASE_URL}). Check EXPO_PUBLIC_API_BASE_URL and ensure it points to backend.`
  );

const parseResponse = async (res) => {
  const text = await res.text();
  const contentType = String(res.headers?.get?.('content-type') || '').toLowerCase();
  const jsonContentType = contentType.includes('application/json') || contentType.includes('+json');
  let payload = null;
  let parseFailed = false;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      parseFailed = true;
      if (contentType.includes('text/html') || looksLikeHtml(text)) {
        const err = invalidApiResponseError();
        err.status = res.status;
        throw err;
      }
      payload = { message: text };
    }
  }

  if (!res.ok) {
    // 1. Firebase error payload
    if (payload?.error?.message) {
      const err = new Error(payload.error.message);
      err.code = payload.error.message;
      err.status = res.status;
      throw err;
    }
    // 2. Spring Boot / Backend ApiError payload
    if (payload?.message) {
      const err = new Error(payload.message);
      err.status = res.status;
      throw err;
    }
    // 3. Fallback
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }

  if (res.ok && text) {
    const payloadLooksStructured = payload && typeof payload === 'object';
    if (!jsonContentType || parseFailed || !payloadLooksStructured) {
      const err = invalidApiResponseError();
      err.status = res.status;
      throw err;
    }
  }

  return payload;
};

const formatAuthError = (error) => {
  console.log('[AuthDebug] Raw Error:', error);
  const msg = error?.message || String(error);

  if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('EMAIL_NOT_FOUND') || msg.includes('INVALID_PASSWORD')) {
    return 'Incorrect email or password.';
  }
  if (msg.includes('EMAIL_EXISTS')) {
    return 'This email is already in use.';
  }
  if (msg.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return 'Too many failed attempts. Please try again later.';
  }
  if (msg.includes('Network request failed') || msg.includes('Aborted')) {
    return 'Unable to connect to server. Please check your internet or IP configuration.';
  }

  // Fallback for backend errors or unexpected types
  return typeof msg === 'string' ? msg : 'An unexpected authentication error occurred.';
};

const authRequest = async (path, options = {}) => {
  const { method = 'GET', body } = options;
  return parseResponse(
    await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: body ? JSON.stringify(body) : undefined,
    })
  );
};

const isSessionProfilePayload = (profile) =>
  !!profile &&
  typeof profile === 'object' &&
  profile.id !== undefined &&
  profile.id !== null &&
  typeof profile.role === 'string' &&
  profile.role.trim().length > 0;

const requireSessionProfilePayload = (profile, contextLabel) => {
  if (!isSessionProfilePayload(profile)) {
    throw new Error(
      `${contextLabel} failed due to invalid server response. Check API base URL and backend auth endpoint routing.`
    );
  }
  return profile;
};

const firebaseRequest = async (path, body) => {
  if (!FIREBASE_API_KEY) {
    throw new Error('Firebase API key is not configured.');
  }
  return parseResponse(
    await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
};

const resolveMobileRole = (profile = {}) => {
  const backendRole = String(profile.role || '').trim().toUpperCase();
  if (backendRole === 'DRIVER') return 'driver';
  if (backendRole === 'CUSTOMER') return 'customer';

  const modules = new Set((profile.allowedModules || []).map((item) => String(item).toLowerCase()));
  if (modules.has('driver-delivery')) return 'driver';
  if (
    modules.has('customer-booking') ||
    modules.has('customer-tracking') ||
    modules.has('customer-orders')
  ) {
    return 'customer';
  }

  return '';
};

const mapSessionProfile = (profile, fallback = null) => ({
  id: String(profile.id),
  fullName: profile.fullName || 'WashAlert User',
  email: profile.email || '',
  phone: profile.mobileNumber || profile.phone || fallback?.phone || '',
  profileImageUrl: profile.profileImageUrl || fallback?.profileImageUrl || '',
  role: resolveMobileRole(profile),
  status: String(profile.status || '').toLowerCase(),
  backendRole: profile.role || '',
  allowedModules: profile.allowedModules || [],
  platform: profile.platform || 'MOBILE',
  branch: profile.branch || '',
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseSession, setFirebaseSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const minDelay = new Promise((r) => setTimeout(r, 800));
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const storedFirebaseSession = await AsyncStorage.getItem(FIREBASE_SESSION_STORAGE_KEY);
      const localUser = stored ? JSON.parse(stored) : null;
      const localFirebaseSession = storedFirebaseSession ? JSON.parse(storedFirebaseSession) : null;
      setFirebaseSession(localFirebaseSession);

      if (localUser) {
        setUser(localUser);
        try {
          const profile = await authRequest('/api/auth/me');
          const mapped = mapSessionProfile(profile, localUser);
          if (!mapped.role) {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            setUser(null);
          } else {
            setUser(mapped);
            await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          }
        } catch (error) {
          if (error?.status === 401 || error?.status === 403) {
            await AsyncStorage.removeItem(USER_STORAGE_KEY);
            await clearFirebaseSession();
            setUser(null);
          }
        }
      }

      await minDelay;
    } catch (error) {
      console.error('Failed to restore user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persistFirebaseSession = async (session = {}) => {
    if (!session?.idToken) return;
    const normalized = {
      idToken: String(session.idToken),
      refreshToken: session.refreshToken ? String(session.refreshToken) : '',
    };
    setFirebaseSession(normalized);
    await AsyncStorage.setItem(FIREBASE_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  };

  const clearFirebaseSession = async () => {
    setFirebaseSession(null);
    await AsyncStorage.removeItem(FIREBASE_SESSION_STORAGE_KEY);
  };

  const login = useCallback(async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !/\S+@\S+\.\S+/.test(normalizedEmail)) {
      return { success: false, error: 'Invalid email format' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    try {
      const firebaseLogin = await firebaseRequest('accounts:signInWithPassword', {
        email: normalizedEmail,
        password,
        returnSecureToken: true,
      });
      await persistFirebaseSession({
        idToken: firebaseLogin.idToken,
        refreshToken: firebaseLogin.refreshToken,
      });

      const challenge = await authRequest('/api/auth/firebase-login-otp/request', {
        method: 'POST',
        body: {
          idToken: firebaseLogin.idToken,
          platform: 'MOBILE',
        },
      });
      return {
        success: true,
        requiresOtp: true,
        email: normalizedEmail,
        resendCooldownSeconds: challenge?.resendCooldownSeconds || 60,
      };
    } catch (error) {
      await clearFirebaseSession();
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const register = useCallback(async (data) => {
    const normalizedEmail = normalizeEmail(data.email);
    try {
      const signup = await firebaseRequest('accounts:signUp', {
        email: normalizedEmail,
        password: data.password,
        returnSecureToken: true,
      });
      const registerProfile = await authRequest('/api/auth/mobile/register-profile', {
        method: 'POST',
        body: {
          idToken: signup.idToken,
          fullName: data.fullName,
        },
      });
      const createdProfile = requireSessionProfilePayload(registerProfile, 'Registration');
      if (String(createdProfile.role || '').trim().toUpperCase() !== 'CUSTOMER') {
        await clearFirebaseSession();
        return {
          success: false,
          error: `Registered account has unexpected role "${createdProfile.role || 'UNKNOWN'}". Please contact support.`,
        };
      }
      await persistFirebaseSession({
        idToken: signup.idToken,
        refreshToken: signup.refreshToken,
      });
      return {
        success: true,
        message: 'Registration successful. You can now log in.',
      };
    } catch (error) {
      await clearFirebaseSession();
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const signup = register;

  const logout = useCallback(async () => {
    try {
      try {
        await authRequest('/api/auth/logout', { method: 'POST' });
      } catch {
        // best effort
      }
      await clearFirebaseSession();
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const updateUserProfile = useCallback(async (updates = {}) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        ...updates,
      };
      void AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const changePassword = useCallback(async ({ currentPassword, newPassword }) => {
    if (!user?.email) {
      return { success: false, error: 'No authenticated user email available.' };
    }
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Current and new passwords are required.' };
    }

    try {
      const reauth = await firebaseRequest('accounts:signInWithPassword', {
        email: normalizeEmail(user.email),
        password: currentPassword,
        returnSecureToken: true,
      });

      const updated = await firebaseRequest('accounts:update', {
        idToken: reauth.idToken,
        password: newPassword,
        returnSecureToken: true,
      });

      await persistFirebaseSession({
        idToken: updated.idToken || reauth.idToken,
        refreshToken: updated.refreshToken || reauth.refreshToken,
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, [user?.email]);

  const forgotPassword = useCallback(async (email) => {
    try {
      // Switch from Firebase direct to Backend to use unified email system
      await authRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: normalizeEmail(email) },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const requestOTP = useCallback(async (email) => {
    try {
      await authRequest('/api/auth/otp/request', {
        method: 'POST',
        body: { email: normalizeEmail(email) },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const requestResetOTP = useCallback(async (email) => {
    try {
      await authRequest('/api/auth/otp/forgot-password', {
        method: 'POST',
        body: { email: normalizeEmail(email) },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const verifyResetOTP = useCallback(async (email, code) => {
    try {
      await authRequest('/api/auth/otp/verify-reset', {
        method: 'POST',
        body: { email: normalizeEmail(email), code },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const verifyOTP = useCallback(async (code, email) => {
    try {
      const profile = await authRequest('/api/auth/otp/verify', {
        method: 'POST',
        body: { email: normalizeEmail(email), code },
      });

      const mapped = mapSessionProfile(requireSessionProfilePayload(profile, 'OTP verification'));
      if (!mapped.role) {
        return {
          success: false,
          error: `Account role "${mapped.backendRole || 'UNKNOWN'}" is not allowed on mobile.`,
        };
      }

      setUser(mapped);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
      return { success: true, user: mapped, autoLogin: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const requestLoginOTP = useCallback(async () => {
    if (!firebaseSession?.idToken) {
      return { success: false, error: 'Login session expired. Please sign in again.' };
    }
    try {
      const challenge = await authRequest('/api/auth/firebase-login-otp/resend', {
        method: 'POST',
        body: {
          idToken: firebaseSession.idToken,
          platform: 'MOBILE',
        },
      });
      return {
        success: true,
        resendCooldownSeconds: challenge?.resendCooldownSeconds || 60,
      };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, [firebaseSession?.idToken]);

  const verifyLoginOTP = useCallback(async (code) => {
    if (!firebaseSession?.idToken) {
      return { success: false, error: 'Login session expired. Please sign in again.' };
    }
    try {
      const profile = await authRequest('/api/auth/firebase-login-otp/verify', {
        method: 'POST',
        body: {
          idToken: firebaseSession.idToken,
          platform: 'MOBILE',
          code,
        },
      });
      const mapped = mapSessionProfile(requireSessionProfilePayload(profile, 'Login OTP verification'));
      if (!mapped.role) {
        await clearFirebaseSession();
        return {
          success: false,
          error: `Account role "${mapped.backendRole || 'UNKNOWN'}" is not allowed on mobile.`,
        };
      }

      setUser(mapped);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
      return { success: true, user: mapped, autoLogin: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, [firebaseSession?.idToken]);

  const resetPassword = useCallback(async (email, newPassword) => {
    try {
      await authRequest('/api/auth/otp/reset-password', {
        method: 'POST',
        body: { email: normalizeEmail(email), newPassword },
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        loading: isLoading,
        login,
        register,
        signup,
        logout,
        forgotPassword,
        requestOTP,
        requestLoginOTP,
        requestResetOTP,
        verifyOTP,
        verifyLoginOTP,
        verifyResetOTP,
        resetPassword,
        updateUserProfile,
        changePassword,
        firebaseIdToken: firebaseSession?.idToken || '',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
