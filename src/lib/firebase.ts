import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "todaysell-d4bbc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let services: FirebaseServices | null = null;

export function getFirebaseServices(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (!services) {
    const app = initializeApp(firebaseConfig);
    services = {
      app,
      auth: getAuth(app),
      db: getFirestore(app)
    };
  }
  return services;
}

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  const current = getFirebaseServices();
  if (!current) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(current.auth, callback);
}

export async function loginWithEmail(email: string, password: string): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 목업 모드로 실행 중입니다.");
  await signInWithEmailAndPassword(current.auth, email, password);
}

export async function logout(): Promise<void> {
  const current = getFirebaseServices();
  if (current) await signOut(current.auth);
}
