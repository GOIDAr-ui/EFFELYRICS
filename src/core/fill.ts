export function fillProgress(time: number, start: number, end: number) {
  if (![time,start,end].every(Number.isFinite) || end <= start) return 0;
  return Math.max(0, Math.min(1, (time-start)/(end-start)));
}
