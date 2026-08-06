import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { API_BASE_URL, FIREBASE_API_KEY, FIREBASE_PROJECT_ID } from '../config/env';
import { auth as firebaseAuth } from '../services/firebase';

const AuthContext = createContext(undefined);

const USER_STORAGE_KEY = 'userData';
const FIREBASE_SESSION_STORAGE_KEY = 'firebaseSessionData';
const HAS_SEEN_ONBOARDING_STORAGE_KEY = 'hasSeenOnboarding';
const EXPECTED_FIREBASE_PROJECT_ID = 'washalert-b8ce8';
const EXPECTED_FIREBASE_ISSUER = `https://securetoken.google.com/${EXPECTED_FIREBASE_PROJECT_ID}`;
const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const looksLikeHtml = (value) => /<!doctype html|<html[\s>]/i.test(String(value || ''));
const looksLikeNgrokWarningPage = (value) =>
  /ngrok/i.test(String(value || '')) &&
  /(visit site|tunnel|ERR_NGROK|ngrok-free\.dev)/i.test(String(value || ''));
const NGROK_SKIP_BROWSER_WARNING_HEADER = { 'ngrok-skip-browser-warning': 'true' };
const normalizePath = (path) => {
  const normalized = String(path || '').trim();
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};
const buildBackendUrl = (path) => {
  const base = String(API_BASE_URL || '').replace(/\/+$/, '');
  const normalizedPath = normalizePath(path);
  if (base.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${base}${normalizedPath.slice(4)}`;
  }
  return `${base}${normalizedPath}`;
};
const toResponsePreview = (text) => String(text || '').replace(/\s+/g, ' ').trim().slice(0, 120);

const invalidApiResponseError = () =>
  new Error(
    `Backend returned HTML. Check ngrok warning/API base URL. (${API_BASE_URL})`
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
        const preview = toResponsePreview(text);
        if (__DEV__) {
          console.warn('[Auth][NonJSON] HTML response detected', {
            status: res.status,
            contentType,
            preview,
          });
        }
        const err = looksLikeNgrokWarningPage(text)
          ? new Error(`Ngrok warning page received. Header may not be sent or URL is wrong. (${API_BASE_URL})`)
          : invalidApiResponseError();
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
      const preview = toResponsePreview(text);
      if (__DEV__) {
        console.warn('[Auth][NonJSON] Unexpected non-JSON success response', {
          status: res.status,
          contentType,
          preview,
        });
      }
      const err = looksLikeNgrokWarningPage(text)
        ? new Error(`Ngrok warning page received. Header may not be sent or URL is wrong. (${API_BASE_URL})`)
        : invalidApiResponseError();
      err.status = res.status;
      throw err;
    }
  }

  return payload;
};

const decodeBase64Url = (value = '') => {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    if (typeof globalThis?.atob === 'function') {
      return globalThis.atob(padded);
    }
  } catch {
    return '';
  }
  return '';
};

const parseJwtPayload = (token = '') => {
  const parts = String(token).split('.');
  if (parts.length < 2) return {};
  try {
    const decoded = decodeBase64Url(parts[1]);
    return decoded ? JSON.parse(decoded) : {};
  } catch {
    return {};
  }
};

const logFirebaseTokenDiagnostics = (token, contextLabel) => {
  const payload = parseJwtPayload(token);
  const aud = String(payload?.aud || '');
  const iss = String(payload?.iss || '');
  const exp = Number(payload?.exp || 0);
  const expIso = Number.isFinite(exp) && exp > 0 ? new Date(exp * 1000).toISOString() : null;

  console.info('[Auth][Mobile] Firebase token diagnostics', {
    context: contextLabel,
    tokenLength: String(token || '').length,
    aud: aud || '(missing)',
    iss: iss || '(missing)',
    exp: exp || null,
    expIso,
  });

  if (aud && aud !== EXPECTED_FIREBASE_PROJECT_ID) {
    console.warn('[Auth][Mobile] Firebase token aud mismatch', {
      expectedAud: EXPECTED_FIREBASE_PROJECT_ID,
      actualAud: aud,
    });
  }
  if (iss && iss !== EXPECTED_FIREBASE_ISSUER) {
    console.warn('[Auth][Mobile] Firebase token iss mismatch', {
      expectedIss: EXPECTED_FIREBASE_ISSUER,
      actualIss: iss,
    });
  }
};

const formatAuthError = (error) => {
  console.log('[AuthDebug] Raw Error:', error);
  const msg = String(error?.message || error || '').trim();
  const normalized = msg.toUpperCase();

  if (
    normalized.includes('INVALID_LOGIN_CREDENTIALS') ||
    normalized.includes('AUTH/INVALID-CREDENTIAL') ||
    normalized.includes('INVALID_CREDENTIAL') ||
    normalized.includes('EMAIL_NOT_FOUND') ||
    normalized.includes('INVALID_PASSWORD')
  ) {
    return 'Invalid email or password.';
  }
  if (normalized.includes('USER_DISABLED') || normalized.includes('AUTH/USER-DISABLED')) {
    return 'This account is disabled.';
  }
  if (normalized.includes('EMAIL_EXISTS')) {
    return 'This email is already in use.';
  }
  if (normalized.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) {
    return 'Too many failed attempts. Please try again later.';
  }
  if (
    normalized.includes('NETWORK REQUEST FAILED') ||
    normalized.includes('FAILED TO FETCH') ||
    normalized.includes('NETWORK ERROR') ||
    normalized.includes('ABORT')
  ) {
    return 'Unable to connect to server. Please check your internet or IP configuration.';
  }

  // Fallback for backend errors or unexpected types
  return typeof msg === 'string' ? msg : 'An unexpected authentication error occurred.';
};

const authRequest = async (path, options = {}) => {
  const { method = 'GET', body, headers = {} } = options;
  const url = buildBackendUrl(path);
  const requestHeaders = {
    'Content-Type': 'application/json',
    ...NGROK_SKIP_BROWSER_WARNING_HEADER,
    ...headers,
  };
  if (__DEV__) {
    console.info('[Auth][Request]', {
      method,
      url,
      headerKeys: Object.keys(requestHeaders),
    });
  }
  return parseResponse(
    await fetch(url, {
      method,
      headers: requestHeaders,
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
  if (backendRole === 'STAFF') return 'staff';
  if (backendRole === 'ADMIN') return 'admin';

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
  mustChangePassword: Boolean(profile.mustChangePassword),
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [firebaseSession, setFirebaseSession] = useState(null);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const bootstrapAsync = useCallback(async () => {
    try {
      const minDelay = new Promise((r) => setTimeout(r, 800));
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const storedFirebaseSession = await AsyncStorage.getItem(FIREBASE_SESSION_STORAGE_KEY);
      const storedHasSeenOnboarding = await AsyncStorage.getItem(HAS_SEEN_ONBOARDING_STORAGE_KEY);
      const localUser = stored ? JSON.parse(stored) : null;
      const localFirebaseSession = storedFirebaseSession ? JSON.parse(storedFirebaseSession) : null;
      setHasSeenOnboarding(storedHasSeenOnboarding === 'true');
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
  }, []);

  useEffect(() => {
    void bootstrapAsync();
  }, [bootstrapAsync]);

  const persistFirebaseSession = async (session = {}) => {
    if (!session?.idToken) return;
    const normalized = {
      idToken: String(session.idToken),
      refreshToken: session.refreshToken ? String(session.refreshToken) : '',
      email: session.email ? String(session.email).trim().toLowerCase() : '',
    };
    setFirebaseSession(normalized);
    await AsyncStorage.setItem(FIREBASE_SESSION_STORAGE_KEY, JSON.stringify(normalized));
  };

  const persistOnboardingSeen = useCallback(async () => {
    setHasSeenOnboarding(true);
    await AsyncStorage.setItem(HAS_SEEN_ONBOARDING_STORAGE_KEY, 'true');
  }, []);

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
      console.info('[Auth][Mobile] Firebase sign-in started', { email: normalizedEmail });
      if (String(FIREBASE_PROJECT_ID || '').trim() !== EXPECTED_FIREBASE_PROJECT_ID) {
        console.warn('[Auth][Mobile] Firebase project mismatch detected', {
          configuredProjectId: FIREBASE_PROJECT_ID || '(missing)',
          expectedProjectId: EXPECTED_FIREBASE_PROJECT_ID,
        });
      }
      const userCredential = await signInWithEmailAndPassword(firebaseAuth, normalizedEmail, password);
      const firebaseIdToken = await userCredential.user.getIdToken(true);
      const firebaseRefreshToken = String(userCredential.user.refreshToken || '');
      console.info('[Auth][Mobile] Firebase sign-in success', { email: normalizedEmail });
      await persistFirebaseSession({
        idToken: firebaseIdToken,
        refreshToken: firebaseRefreshToken,
        email: normalizedEmail,
      });

      console.info('[Auth][Mobile] Direct login started', { email: normalizedEmail });
      logFirebaseTokenDiagnostics(firebaseIdToken, 'firebase/direct-login');
      const result = await authRequest('/api/auth/firebase/direct-login', {
        method: 'POST',
        body: {
          idToken: firebaseIdToken,
          platform: 'MOBILE',
        },
      });
      console.info('[Auth][Mobile] Direct login success', {
        email: normalizedEmail,
        requiresPasswordUpdate: Boolean(result?.requiresPasswordUpdate),
      });
      await persistOnboardingSeen();
      if (result?.requiresPasswordUpdate) {
        return {
          success: true,
          requiresPasswordUpdate: true,
          email: normalizedEmail,
          message: result?.message || 'Password update required before continuing.',
        };
      }
      const profile = requireSessionProfilePayload(result, 'Login');
      const mapped = mapSessionProfile(profile);
      setUser(mapped);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
      return {
        success: true,
        user: mapped,
      };
    } catch (error) {
      console.error('[Auth][Mobile] Login flow failed', error);
      await clearFirebaseSession();
      return { success: false, error: formatAuthError(error) };
    }
  }, [persistOnboardingSeen]);

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
        email: normalizedEmail,
      });
      await persistOnboardingSeen();
      return {
        success: true,
        message: 'Registration successful. You can now log in.',
      };
    } catch (error) {
      await clearFirebaseSession();
      return { success: false, error: formatAuthError(error) };
    }
  }, [persistOnboardingSeen]);

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

  const changePassword = useCallback(async ({ currentPassword, newPassword, forcePasswordUpdate = false }) => {
    const accountEmail = normalizeEmail(user?.email || firebaseSession?.email || '');
    if (!accountEmail) {
      return { success: false, error: 'No authenticated user email available.' };
    }
    if (!currentPassword || !newPassword) {
      return { success: false, error: 'Current and new passwords are required.' };
    }

    try {
      const reauth = await firebaseRequest('accounts:signInWithPassword', {
        email: accountEmail,
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
        email: accountEmail,
      });
      if (forcePasswordUpdate) {
        const sessionProfile = await authRequest('/api/auth/firebase/complete-first-login-password', {
          method: 'POST',
          body: {
            idToken: updated.idToken || reauth.idToken,
            platform: 'MOBILE',
          },
        });
        const mapped = mapSessionProfile(requireSessionProfilePayload(sessionProfile, 'First-login password update'));
        setUser(mapped);
        await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
        await persistOnboardingSeen();
        return { success: true, autoLogin: true, user: mapped };
      }
      return { success: true };
    } catch (error) {
      const rawMessage = String(error?.message || error || '').toUpperCase();
      const wrongCurrentPassword =
        rawMessage.includes('INVALID_LOGIN_CREDENTIALS') ||
        rawMessage.includes('AUTH/INVALID-CREDENTIAL') ||
        rawMessage.includes('INVALID_CREDENTIAL') ||
        rawMessage.includes('INVALID_PASSWORD') ||
        rawMessage.includes('EMAIL_NOT_FOUND');
      // This screen only has a "Current Password" field, not an email field —
      // formatAuthError's generic "Invalid email or password." (written for
      // the login screen) is confusing here, since there's no email input to
      // point to. Reword it to what the user can actually act on.
      if (wrongCurrentPassword) {
        return { success: false, error: 'Current password is incorrect.' };
      }
      return { success: false, error: formatAuthError(error) };
    }
  }, [firebaseSession?.email, persistOnboardingSeen, user?.email]);

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
      await persistOnboardingSeen();
      return { success: true, user: mapped, autoLogin: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, [persistOnboardingSeen]);

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
      await persistOnboardingSeen();
      return { success: true, user: mapped, autoLogin: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, [firebaseSession?.idToken, persistOnboardingSeen]);

  const completeOnboarding = useCallback(async () => {
    await persistOnboardingSeen();
  }, [persistOnboardingSeen]);

  const resetPassword = useCallback(async (email, newPassword, code) => {
    try {
      await authRequest('/api/auth/otp/reset-password', {
        method: 'POST',
        body: { email: normalizeEmail(email), code, newPassword },
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
        hasSeenOnboarding,
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
        completeOnboarding,
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
