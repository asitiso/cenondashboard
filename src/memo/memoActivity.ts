export function freezeMemoActivity(
  foreground: { current: boolean },
  generation: { current: number },
  scheduleAfterPaint: (work: () => void) => void,
  finish: () => void
): void {
  if (!foreground.current) return;
  foreground.current = false;
  generation.current += 1;
  scheduleAfterPaint(() => {
    if (!foreground.current) finish();
  });
}
