export const CREATOR_PAGE_SIZE = 20;
export const REFILL_THRESHOLD = 10;
export const NEW_CREATOR_WINDOW_MS = 72 * 60 * 60 * 1000;
export function isNewCreator(firstAvailableAt: string | null, now: number): boolean {
  if (!firstAvailableAt) return false;
  const age = now - Date.parse(firstAvailableAt);
  return age >= 0 && age < NEW_CREATOR_WINDOW_MS;
}
