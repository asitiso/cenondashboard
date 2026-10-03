import {
  collection,
  doc,
  getDocs,
  increment,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { getFirebaseServices } from "../lib/firebase";
import type { Preferences, Snapshot, UsageDay } from "./types";

export const emptyPreferences: Preferences = {
  units: {},
  suppliers: {},
  overrides: {},
  folders: [],
  bookmarks: [],
};
export function encodeSnapshot(value: unknown): string[] {
  const json = JSON.stringify(value);
  const chunks: string[] = [];
  for (let i = 0; i < json.length; i += 180000)
    chunks.push(json.slice(i, i + 180000));
  return chunks;
}
export function decodeSnapshot(chunks: string[]): Snapshot {
  return JSON.parse(chunks.join("")) as Snapshot;
}
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("cenon-order-finder", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(new Error("이 PC에 저장할 공간을 열지 못했습니다."));
  });
}
export async function readCache<T>(key: string): Promise<T | undefined> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("state", "readonly");
    const r = tx.objectStore("state").get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => d.close();
  });
}
export async function writeCache(key: string, value: unknown): Promise<void> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("state", "readwrite");
    tx.objectStore("state").put(value, key);
    tx.oncomplete = () => {
      d.close();
      resolve();
    };
    tx.onerror = () => {
      d.close();
      reject(
        new Error(
          "이 PC에 자료를 저장하지 못했습니다. 저장 공간을 확인해 주세요.",
        ),
      );
    };
  });
}
export function watchPreferences(
  onValue: (p: Preferences) => void,
  onError: (e: string) => void,
) {
  const s = getFirebaseServices();
  if (!s) return () => {};
  return onSnapshot(
    doc(s.db, "order_finder", "preferences"),
    (x) =>
      onValue(
        x.exists()
          ? ({ ...emptyPreferences, ...x.data() } as Preferences)
          : emptyPreferences,
      ),
    (e) => onError(`공용 설정을 불러오지 못했습니다: ${e.message}`),
  );
}
export function watchSnapshot(
  onValue: (s: Snapshot) => void,
  onError: (e: string) => void,
  onVersion?: (v: string | undefined) => void,
) {
  const s = getFirebaseServices();
  if (!s) return () => {};
  let disposed = false;
  let generation = 0;
  const stop = onSnapshot(
    doc(s.db, "order_finder", "active"),
    async (metadata) => {
      const gen = ++generation;
      onVersion?.(metadata.data()?.version as string | undefined);
      if (!metadata.exists()) return;
      try {
        const version = metadata.data().version as string;
        const cached = await readCache<Snapshot>("snapshot");
        if (cached?.version === version) {
          if (!disposed && gen === generation) onValue(cached);
          return;
        }
        const all = await getDocs(
          collection(s.db, "order_finder_versions", version, "chunks"),
        );
        if (all.size !== metadata.data().chunks)
          throw new Error("일부 자료가 아직 준비되지 않았습니다.");
        const chunks = all.docs
          .map((d) => ({
            index: d.data().index as number,
            content: d.data().content as string,
          }))
          .sort((a, b) => a.index - b.index)
          .map((d) => d.content);
        const value = decodeSnapshot(chunks);
        if (value.version !== version)
          throw new Error("자료 버전이 일치하지 않습니다.");
        if (!disposed && gen === generation) {
          await writeCache("snapshot", value);
          onValue(value);
        }
      } catch (e) {
        onError(
          e instanceof Error ? e.message : "공용 자료를 불러오지 못했습니다.",
        );
      }
    },
    (e) => onError(`공용 자료 연결 실패: ${e.message}`),
  );
  return () => {
    disposed = true;
    stop();
  };
}
export async function publishSnapshot(
  value: Snapshot,
  expectedVersion?: string,
  classification?: { baseId: string; code: string },
  currentPreferences: Preferences = emptyPreferences,
) {
  const s = getFirebaseServices();
  let preferences: Preferences | undefined;
  if (s) {
    const chunks = encodeSnapshot(value);
    for (let i = 0; i < chunks.length; i++)
      await setDoc(
        doc(s.db, "order_finder_versions", value.version, "chunks", String(i)),
        { index: i, content: chunks[i] },
      );
    await runTransaction(s.db, async (tx) => {
      const active = doc(s.db, "order_finder", "active");
      const old = await tx.get(active);
      if ((old.data()?.version ?? undefined) !== expectedVersion)
        throw new Error(
          "다른 직원이 자료를 갱신했습니다. 최신 자료를 불러온 뒤 다시 가져와 주세요.",
        );
      if (classification) {
        const prefDoc = doc(s.db, "order_finder", "preferences");
        const stored = await tx.get(prefDoc);
        const prior = stored.exists()
          ? ({ ...emptyPreferences, ...stored.data() } as Preferences)
          : emptyPreferences;
        preferences = {
          ...prior,
          overrides: {
            ...prior.overrides,
            [classification.baseId]: classification.code,
          },
        };
        tx.set(prefDoc, JSON.parse(JSON.stringify(preferences)));
      }
      tx.set(active, {
        version: value.version,
        asOf: value.asOf,
        chunks: chunks.length,
        importedAt: value.importedAt,
      });
    });
  } else if (classification)
    preferences = {
      ...currentPreferences,
      overrides: {
        ...currentPreferences.overrides,
        [classification.baseId]: classification.code,
      },
    };
  await writeCache("snapshot", value);
  if (preferences) await writeCache("preferences", preferences);
  return preferences;
}
export async function mutatePreferences(
  current: Preferences,
  change: (p: Preferences) => Preferences,
): Promise<Preferences> {
  const s = getFirebaseServices();
  let value: Preferences;
  if (s) {
    value = await runTransaction(s.db, async (tx) => {
      const ref = doc(s.db, "order_finder", "preferences");
      const old = await tx.get(ref);
      const next = change(
        old.exists()
          ? ({ ...emptyPreferences, ...old.data() } as Preferences)
          : emptyPreferences,
      );
      tx.set(ref, JSON.parse(JSON.stringify(next)));
      return next;
    });
  } else value = change(current);
  await writeCache("preferences", value);
  return value;
}
export function watchUsage(
  asOf: string,
  onValue: (days: UsageDay[]) => void,
  onError: (e: string) => void,
) {
  const s = getFirebaseServices();
  if (!s) return () => {};
  const start = new Date(`${asOf}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return onSnapshot(
    query(
      collection(s.db, "order_usage_days"),
      where("date", ">=", start.toISOString().slice(0, 10)),
    ),
    (x) => onValue(x.docs.map((d) => d.data() as UsageDay)),
    (e) => onError(`공용 사용량을 불러오지 못했습니다: ${e.message}`),
  );
}
export async function recordUsage(id: string, date: string, days: UsageDay[]) {
  const s = getFirebaseServices();
  if (s)
    await setDoc(
      doc(s.db, "order_usage_days", date),
      { date, counts: { [id]: increment(1) } },
      { merge: true },
    );
  const next = days.some((d) => d.date === date)
    ? days.map((d) =>
        d.date === date
          ? { ...d, counts: { ...d.counts, [id]: (d.counts[id] ?? 0) + 1 } }
          : d,
      )
    : [...days, { date, counts: { [id]: 1 } }];
  await writeCache("usage", next);
  return next;
}
