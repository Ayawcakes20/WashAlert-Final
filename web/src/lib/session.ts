import type { MeResponse } from "@/lib/api";

export const SESSION_KEY = "washalert_web_user";
const FIREBASE_WEB_SESSION_KEY = "washalert_web_firebase_session";

export type FirebaseWebSession = {
  idToken: string;
  refreshToken: string;
  selectedBranch?: string;
  email?: string;
};

export const saveSessionUser = (user: MeResponse) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
};

export const getSessionUser = (): MeResponse | null => {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as MeResponse;
  } catch {
    return null;
  }
};

export const clearSessionUser = () => {
  localStorage.removeItem(SESSION_KEY);
};

export const saveFirebaseWebSession = (session: FirebaseWebSession) => {
  localStorage.setItem(FIREBASE_WEB_SESSION_KEY, JSON.stringify(session));
};

export const getFirebaseWebSession = (): FirebaseWebSession | null => {
  const raw = localStorage.getItem(FIREBASE_WEB_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FirebaseWebSession;
  } catch {
    return null;
  }
};

export const clearFirebaseWebSession = () => {
  localStorage.removeItem(FIREBASE_WEB_SESSION_KEY);
};
