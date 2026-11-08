import { ClothingItem } from "@/types/closet";

const DB_NAME = "closetme_db";
const DB_VERSION = 1;
const STORE_NAME = "wardrobe_store";
const WARDROBE_KEY = "user_wardrobe";
const LOCAL_STORAGE_KEY = "closetme_saved_wardrobe";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * 保存されたクローゼットデータを取得
 */
export async function loadSavedWardrobe(): Promise<ClothingItem[] | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(WARDROBE_KEY);
      req.onsuccess = () => {
        if (req.result && Array.isArray(req.result) && req.result.length > 0) {
          resolve(req.result);
        } else {
          // localStorage フォールバック
          resolve(loadFromLocalStorage());
        }
      };
      req.onerror = () => resolve(loadFromLocalStorage());
    });
  } catch {
    return loadFromLocalStorage();
  }
}

function loadFromLocalStorage(): ClothingItem[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * クローゼットデータを保存
 */
export async function saveWardrobe(wardrobe: ClothingItem[]): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(wardrobe, WARDROBE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // IndexedDB失敗時はlocalStorageにフォールバック（画像サイズ等で上限がある場合は一部削るなどの配慮）
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(wardrobe));
      }
    } catch (e) {
      console.warn("Storage quota exceeded or unavailable:", e);
    }
  }
}

/**
 * 保存データをリセット（デモデータ復帰用）
 */
export async function clearSavedWardrobe(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(WARDROBE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // ignore
  }
  if (typeof window !== "undefined") {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  }
}
