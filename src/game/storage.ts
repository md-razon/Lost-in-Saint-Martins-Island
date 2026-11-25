import { SaveData } from './types';

const SAVE_KEY = 'lost_in_saint_martin_save_v1';

export function loadSaveData(): SaveData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SaveData;
    if (typeof parsed.levelId !== 'number' || parsed.levelId < 1 || parsed.levelId > 7) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSaveData(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSaveData(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Ignore
  }
}
