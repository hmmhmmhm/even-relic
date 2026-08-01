import type { EvenStorage } from "./live-cache";

export function createBrowserStorage(): EvenStorage {
  return {
    async getLocalStorage(key) {
      return typeof localStorage === "undefined"
        ? ""
        : localStorage.getItem(key) ?? "";
    },
    async setLocalStorage(key, value) {
      if (typeof localStorage === "undefined") return false;
      if (value) localStorage.setItem(key, value);
      else localStorage.removeItem(key);
      return true;
    },
  };
}
