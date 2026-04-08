const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY;
const FIREBASE_SECURE_TOKEN_URL = "https://securetoken.googleapis.com/v1/token";

const firebaseRequest = async <T>(path: string, body: Record<string, unknown>): Promise<T> => {
  if (!FIREBASE_API_KEY) {
    throw new Error("Firebase API key is not configured.");
  }

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || "Firebase request failed.";
    throw new Error(message);
  }

  return data as T;
};

export const firebaseAuthApi = {
  signInWithPassword: (email: string, password: string) =>
    firebaseRequest<{ idToken: string; refreshToken: string; localId: string; email: string }>(
      "accounts:signInWithPassword",
      {
        email,
        password,
        returnSecureToken: true,
      },
    ),
  sendPasswordResetEmail: (email: string) =>
    firebaseRequest("accounts:sendOobCode", {
      requestType: "PASSWORD_RESET",
      email,
    }),
  confirmPasswordReset: (oobCode: string, newPassword: string) =>
    firebaseRequest<{ email: string; requestType: string }>("accounts:resetPassword", {
      oobCode,
      newPassword,
    }),
  refreshIdToken: async (refreshToken: string) => {
    if (!FIREBASE_API_KEY) {
      throw new Error("Firebase API key is not configured.");
    }

    const response = await fetch(`${FIREBASE_SECURE_TOKEN_URL}?key=${FIREBASE_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || "Unable to refresh Firebase session.";
      throw new Error(message);
    }

    return data as {
      access_token: string;
      expires_in: string;
      token_type: string;
      refresh_token: string;
      id_token: string;
      user_id: string;
      project_id: string;
    };
  },
};
