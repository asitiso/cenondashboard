import { useEffect, useRef, useState } from "react";
import { isFirebaseConfigured } from "../lib/firebase";
import { todayKorea } from "./core";
import {
  emptyPreferences,
  mutatePreferences,
  publishSnapshot,
  readCache,
  recordUsage,
  watchPreferences,
  watchSnapshot,
  watchUsage,
  writeCache,
} from "./storage";
import type { Preferences, Snapshot, UsageDay } from "./types";

export function useOrderData() {
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [preferences, setPreferences] = useState<Preferences>(emptyPreferences);
  const [days, setDays] = useState<UsageDay[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const prefRef = useRef(preferences);
  const snapRef = useRef(snapshot);
  const daysRef = useRef(days);
  prefRef.current = preferences;
  snapRef.current = snapshot;
  daysRef.current = days;
  const mutationQueue = useRef<Promise<unknown>>(Promise.resolve());
  const usageQueue = useRef<Promise<unknown>>(Promise.resolve());
  const remoteVersion = useRef<string | undefined>(undefined);
  const remoteReady = useRef(!isFirebaseConfigured);
  useEffect(() => {
    let live = true;
    let stops: Array<() => void> = [];
    (async () => {
      try {
        const [s, p, d] = await Promise.all([
          readCache<Snapshot>("snapshot"),
          readCache<Preferences>("preferences"),
          readCache<UsageDay[]>("usage"),
        ]);
        if (!live) return;
        if (s) setSnapshot(s);
        if (p) setPreferences(p);
        if (d) setDays(d);
        if (!s && import.meta.env.DEV && !isFirebaseConfigured) {
          const response = await fetch("/__order-preview");
          if (response.ok) {
            const value = (await response.json()) as Snapshot;
            await writeCache("snapshot", value);
            if (live) setSnapshot(value);
          }
        }
        stops = [
          watchSnapshot(
            (v) => {
              if (live) {
                remoteReady.current = true;
                setSnapshot(v);
                snapRef.current = v;
              }
            },
            setError,
            (v) => {
              remoteVersion.current = v;
              remoteReady.current = v === undefined;
            },
          ),
          watchPreferences((v) => {
            if (live) {
              setPreferences(v);
              prefRef.current = v;
              void writeCache("preferences", v).catch((e) =>
                setError(String(e)),
              );
            }
          }, setError),
          watchUsage(
            todayKorea(),
            (v) => {
              if (live) {
                setDays(v);
                daysRef.current = v;
              }
            },
            setError,
          ),
        ];
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
      stops.forEach((stop) => stop());
    };
  }, []);
  const saveSnapshot = async (
    value: Snapshot,
    classification?: { baseId: string; code: string },
  ) => {
    if (!remoteReady.current)
      throw new Error("공용 자료를 불러온 뒤 다시 저장해 주세요.");
    const updatedPreferences = await publishSnapshot(
      value,
      isFirebaseConfigured ? value.previousVersion : undefined,
      classification,
      prefRef.current,
    );
    if (updatedPreferences) {
      prefRef.current = updatedPreferences;
      setPreferences(updatedPreferences);
    }
    snapRef.current = value;
    remoteVersion.current = isFirebaseConfigured ? value.version : undefined;
    setSnapshot(value);
  };
  const change = (fn: (p: Preferences) => Preferences) => {
    const task = mutationQueue.current
      .catch(() => {})
      .then(async () => {
        const next = await mutatePreferences(prefRef.current, fn);
        prefRef.current = next;
        setPreferences(next);
      });
    mutationQueue.current = task;
    return task;
  };
  const click = (id: string) => {
    const task = usageQueue.current
      .catch(() => {})
      .then(async () => {
        const next = await recordUsage(id, todayKorea(), daysRef.current);
        if (!isFirebaseConfigured) {
          daysRef.current = next;
          setDays(next);
        }
      });
    usageQueue.current = task;
    return task;
  };
  return {
    snapshot,
    preferences,
    days,
    loading,
    error,
    setError,
    saveSnapshot,
    change,
    click,
    shared: isFirebaseConfigured,
  };
}
