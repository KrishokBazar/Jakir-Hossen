import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface OfflineMutation {
  id: string;
  type: 'set' | 'update' | 'delete';
  collectionName: string;
  docId: string;
  data?: any;
  merge?: boolean;
  timestamp: number;
}

const DB_NAME = 'KrishokBazarOfflineSyncDB';
const STORE_NAME = 'mutations';
const CACHE_STORE_NAME = 'cache';
const DB_VERSION = 2;

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event: any) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!dbInstance.objectStoreNames.contains(CACHE_STORE_NAME)) {
        dbInstance.createObjectStore(CACHE_STORE_NAME, { keyPath: 'key' });
      }
    };
  });
}

export async function setCachedData(key: string, data: any): Promise<void> {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(CACHE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const request = store.put({ key, data, timestamp: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedData<T = any>(key: string): Promise<T | null> {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(CACHE_STORE_NAME, 'readonly');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const request = store.get(key);
    request.onsuccess = () => {
      resolve(request.result ? (request.result.data as T) : null);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function queueOfflineMutation(
  type: 'set' | 'update' | 'delete',
  collectionName: string,
  docId: string,
  data?: any,
  merge?: boolean
): Promise<void> {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const timestamp = Date.now();
    const id = `mutation_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    
    const mutation: OfflineMutation = {
      id,
      type,
      collectionName,
      docId,
      data,
      merge,
      timestamp
    };
    
    const request = store.add(mutation);
    request.onsuccess = () => {
      console.log(`PWA Offline Sync: Mutation queued for ${collectionName}/${docId}`, mutation);
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getOfflineMutations(): Promise<OfflineMutation[]> {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const results = request.result || [];
      // Enforce strict chronological ordering
      results.sort((a, b) => a.timestamp - b.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteOfflineMutation(id: string): Promise<void> {
  const dbInstance = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

let isSyncing = false;

export async function syncOfflineMutations(onProgress?: (message: string, remaining: number) => void): Promise<number> {
  if (isSyncing) {
    console.log("PWA Offline Sync: Synchronization already running.");
    return 0;
  }
  
  if (!navigator.onLine) {
    console.log("PWA Offline Sync: Device offline, sync aborted.");
    return 0;
  }
  
  const mutations = await getOfflineMutations();
  if (mutations.length === 0) {
    return 0;
  }
  
  isSyncing = true;
  console.log(`PWA Offline Sync: Syncing ${mutations.length} mutations...`);
  
  let successCount = 0;
  
  for (const crit of mutations) {
    try {
      if (onProgress) {
        onProgress(`ডাটাবেজ সিঙ্ক হচ্ছে (${mutations.length - successCount} টি পেন্ডিং)`, mutations.length - successCount);
      }
      
      const docRef = doc(db, crit.collectionName, crit.docId);
      if (crit.type === 'set') {
        const payload = { ...crit.data };
        // Convert ISO strings back or keep as-is
        await setDoc(docRef, payload, { merge: !!crit.merge });
      } else if (crit.type === 'update') {
        await updateDoc(docRef, crit.data);
      } else if (crit.type === 'delete') {
        await deleteDoc(docRef);
      }
      
      await deleteOfflineMutation(crit.id);
      successCount++;
    } catch (err) {
      console.error(`PWA Offline Sync: Failed to execute mutation ${crit.id}:`, err);
      const errMsg = err instanceof Error ? err.message : String(err);
      
      // If it is a permission error, remove from queue since retrying won't help
      if (errMsg.includes('permission') || errMsg.includes('Missing or insufficient permissions')) {
        await deleteOfflineMutation(crit.id);
      } else {
        // Transient network issue: stop loop and retry later
        isSyncing = false;
        return successCount;
      }
    }
  }
  
  isSyncing = false;
  return successCount;
}

export function registerBackgroundSync() {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready
      .then((reg: any) => {
        return reg.sync.register('firestore-sync');
      })
      .then(() => {
        console.log("PWA Background Sync: registered 'firestore-sync' tag.");
      })
      .catch((err) => {
        console.warn("PWA Background Sync: registration failed:", err);
      });
  }
}
