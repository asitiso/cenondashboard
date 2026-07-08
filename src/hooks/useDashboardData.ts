import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import type { DashboardItem } from "../types";
import { getFirebaseServices, isFirebaseConfigured, loginWithEmail, logout, setManualReviewStatus, subscribeAuth, toggleDrugPriority } from "../lib/firebase";
import { mockItems } from "../lib/mockData";
import { normalizeDrug, normalizeManualImprove, normalizeTopic } from "../lib/normalize";

interface DashboardDataState {
  items: DashboardItem[];
  user: User | null;
  loading: boolean;
  mockMode: boolean;
  errors: string[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  toggleDrugPriority: (item: DashboardItem) => Promise<void>;
  setManualReviewStatus: (item: DashboardItem, status: string) => Promise<void>;
}

function docsFromSnapshot(snapshot: QuerySnapshot<DocumentData>): Array<[string, Record<string, unknown>]> {
  return snapshot.docs.map((doc) => [doc.id, doc.data() as Record<string, unknown>]);
}

export function useDashboardData(): DashboardDataState {
  const [user, setUser] = useState<User | null>(null);
  const [topics, setTopics] = useState<DashboardItem[]>([]);
  const [manuals, setManuals] = useState<DashboardItem[]>([]);
  const [q1Drugs, setQ1Drugs] = useState<DashboardItem[]>([]);
  const [q2Drugs, setQ2Drugs] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => subscribeAuth(setUser), []);

  useEffect(() => {
    const services = getFirebaseServices();
    if (!services) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const nextErrors = (message: string) => setErrors((prev) => Array.from(new Set([...prev, message])));
    const markLoaded = () => setLoading(false);
    const unsubscribers = [
      onSnapshot(
        collection(services.db, "topics"),
        (snapshot) => {
          setTopics(docsFromSnapshot(snapshot).map(([id, data]) => normalizeTopic(id, data)));
          markLoaded();
        },
        (error) => nextErrors(`topics 조회 오류: ${error.message}`)
      ),
      onSnapshot(
        collection(services.db, "manual_improve"),
        (snapshot) => {
          setManuals(docsFromSnapshot(snapshot).map(([id, data]) => normalizeManualImprove(id, data)));
          markLoaded();
        },
        (error) => nextErrors(`manual_improve 조회 오류: ${error.message}`)
      ),
      onSnapshot(
        collection(services.db, "teams/Q1/drugs"),
        (snapshot) => {
          setQ1Drugs(docsFromSnapshot(snapshot).map(([id, data]) => normalizeDrug(id, data, "Q1")));
          markLoaded();
        },
        (error) => nextErrors(`teams/Q1/drugs 조회 오류: ${error.message}`)
      ),
      onSnapshot(
        collection(services.db, "teams/Q2/drugs"),
        (snapshot) => {
          setQ2Drugs(docsFromSnapshot(snapshot).map(([id, data]) => normalizeDrug(id, data, "Q2")));
          markLoaded();
        },
        (error) => nextErrors(`teams/Q2/drugs 조회 오류: ${error.message}`)
      )
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, []);

  const items = useMemo(() => {
    if (!isFirebaseConfigured) return mockItems;
    return [...topics, ...manuals, ...q1Drugs, ...q2Drugs];
  }, [manuals, q1Drugs, q2Drugs, topics]);

  return {
    items,
    user,
    loading,
    mockMode: !isFirebaseConfigured,
    errors,
    login: loginWithEmail,
    logout,
    toggleDrugPriority: (item) => toggleDrugPriority(item.source.path, !item.isPriority),
    setManualReviewStatus: (item, status) => setManualReviewStatus(item.source.path, status)
  };
}
