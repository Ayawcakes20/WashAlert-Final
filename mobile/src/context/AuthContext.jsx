import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, FIREBASE_API_KEY } from '../config/env';

const AuthContext = createContext(undefined);

const USER_STORAGE_KEY = 'userData';

const parseResponse = async (res) => {
  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
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

const mapSessionProfile = (profile) => ({
  id: String(profile.id),
  fullName: profile.fullName || 'WashAlert User',
  email: profile.email || '',
  phone: '',
  role: resolveMobileRole(profile),
  status: String(profile.status || '').toLowerCase(),
  backendRole: profile.role || '',
  allowedModules: profile.allowedModules || [],
  platform: profile.platform || 'MOBILE',
  branch: profile.branch || '',
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    bootstrapAsync();
  }, []);

  const bootstrapAsync = async () => {
    try {
      const minDelay = new Promise((r) => setTimeout(r, 800));
      const stored = await AsyncStorage.getItem(USER_STORAGE_KEY);
      const localUser = stored ? JSON.parse(stored) : null;

      if (localUser) {
        setUser(localUser);
        try {
          const profile = await authRequest('/api/auth/me');
          const mapped = mapSessionProfile(profile);
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

  const login = useCallback(async (email, password) => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return { success: false, error: 'Invalid email format' };
    }
    if (!password || password.length < 8) {
      return { success: false, error: 'Password must be at least 8 characters' };
    }

    try {
      const firebaseLogin = await firebaseRequest('accounts:signInWithPassword', {
        email,
        password,
        returnSecureToken: true,
      });
      const profile = await authRequest('/api/auth/firebase-session', {
        method: 'POST',
        body: {
          idToken: firebaseLogin.idToken,
          platform: 'MOBILE',
        },
      });
      const mapped = mapSessionProfile(profile);
      if (!mapped.role) {
        return {
          success: false,
          error: `Account role "${mapped.backendRole || 'UNKNOWN'}" is not allowed on mobile.`,
        };
      }

      setUser(mapped);
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
      return { success: true, user: mapped };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const register = useCallback(async (data) => {
    try {
      const signup = await firebaseRequest('accounts:signUp', {
        email: data.email,
        password: data.password,
        returnSecureToken: true,
      });
      await authRequest('/api/auth/mobile/register-profile', {
        method: 'POST',
        body: {
          idToken: signup.idToken,
          fullName: data.fullName,
        },
      });
      return {
        success: true,
        message: 'Registration successful. You can now log in.',
      };
    } catch (error) {
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
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    try {
      // Switch from Firebase direct to Backend to use unified email system
      await authRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
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
        body: { email },
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
        body: { email },
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
        body: { email, code },
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
        body: { email, code },
      });

      // If profile is returned (auto-login), update state
      if (profile && profile.id) {
        const mapped = mapSessionProfile(profile);
        if (mapped.role) {
          setUser(mapped);
          await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(mapped));
          return { success: true, user: mapped, autoLogin: true };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: formatAuthError(error) };
    }
  }, []);

  const resetPassword = useCallback(async (email, newPassword) => {
    try {
      await authRequest('/api/auth/otp/reset-password', {
        method: 'POST',
        body: { email, newPassword },
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
        requestResetOTP,
        verifyOTP,
        verifyResetOTP,
        resetPassword,
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
