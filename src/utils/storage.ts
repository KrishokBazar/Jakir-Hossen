const inMemoryCache: Record<string, string> = {};

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`safeStorage.getItem failed for key "${key}":`, e);
      return inMemoryCache[key] || null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`safeStorage.setItem failed for key "${key}":`, e);
    }
    inMemoryCache[key] = value;
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`safeStorage.removeItem failed for key "${key}":`, e);
    }
    delete inMemoryCache[key];
  },
  clear(): void {
    try {
      localStorage.clear();
    } catch (e) {
      console.warn("safeStorage.clear failed:", e);
    }
    for (const key in inMemoryCache) {
      delete inMemoryCache[key];
    }
  }
};
