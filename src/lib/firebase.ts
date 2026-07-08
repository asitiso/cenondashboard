import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User
} from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getFirestore, serverTimestamp, updateDoc, type Firestore } from "firebase/firestore";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

export interface ManualImproveInput {
  title: string;
  currentProblem: string;
  confirmedFact: string;
  proposal: string;
  category: string;
  priority: string;
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

export async function toggleDrugPriority(path: string, nextPinned: boolean): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 먼저 표시를 변경할 수 없습니다.");
  await updateDoc(doc(current.db, path), { pinned: nextPinned });
}

export async function setManualReviewStatus(path: string, status: string): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 매뉴얼 개선 상태를 변경할 수 없습니다.");
  await updateDoc(doc(current.db, path), {
    status,
    updatedAt: serverTimestamp()
  });
}

function cleanManualInput(input: ManualImproveInput) {
  return {
    title: input.title.trim(),
    currentProblem: input.currentProblem.trim(),
    confirmedFact: input.confirmedFact.trim(),
    proposal: input.proposal.trim(),
    category: input.category.trim(),
    priority: input.priority.trim(),
    status: "반영완료"
  };
}

export async function createManualImprove(input: ManualImproveInput): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 매뉴얼 개선을 추가할 수 없습니다.");
  await addDoc(collection(current.db, "manual_improve"), {
    ...cleanManualInput(input),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: "dashboard"
  });
}

export async function updateManualImprove(path: string, input: ManualImproveInput): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 매뉴얼 개선을 수정할 수 없습니다.");
  await updateDoc(doc(current.db, path), {
    ...cleanManualInput(input),
    updatedAt: serverTimestamp()
  });
}

export async function deleteManualImprove(path: string): Promise<void> {
  const current = getFirebaseServices();
  if (!current) throw new Error("Firebase 설정이 없어 매뉴얼 개선을 삭제할 수 없습니다.");
  await deleteDoc(doc(current.db, path));
}
