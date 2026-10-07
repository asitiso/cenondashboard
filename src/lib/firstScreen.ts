export type FirstScreen = "home" | "memo";
export const FIRST_SCREEN_KEY = "central-onnuri.firstScreen";

export function getFirstScreen(storage?: Storage): FirstScreen {
  try { return (storage ?? globalThis.localStorage)?.getItem(FIRST_SCREEN_KEY) === "memo" ? "memo" : "home"; }
  catch { return "home"; }
}

export function setFirstScreen(screen: FirstScreen, storage?: Storage): void {
  try { (storage ?? globalThis.localStorage)?.setItem(FIRST_SCREEN_KEY, screen); } catch { /* local preference is optional */ }
}
