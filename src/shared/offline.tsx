/**
 * offline.ts – PesaPro offline-first utilities
 *
 * Drop this alongside DashboardPage.tsx and import what you need.
 *
 * Exports:
 *  - useOnlineStatus()          → boolean (true = online)
 *  - useOfflineBanner()         → JSX element ready to render
 *  - db                         → tiny IndexedDB wrapper
 *  - cachedTransactions         → read/write transactions locally
 *  - syncQueue                  → queue writes for when connectivity returns
 *  - registerServiceWorker()    → call once in your app entry point
 */

import { useState, useEffect } from 'react';
import type { ParsedTransaction } from './mpesaParser';

// ─────────────────────────────────────────────────────────────────────────────
// 1. ONLINE STATUS HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactively tracks whether the device has a network connection.
 * Combines navigator.onLine with the online/offline events so it
 * updates in real time without polling.
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const on  = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return online;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. OFFLINE BANNER — ready-to-render React element
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a banner element you can place at the top of any screen.
 * Shows only when offline, animates in/out, disappears when back online.
 *
 * Usage in DashboardPage.tsx:
 *   import { useOfflineBanner } from './offline';
 *   const OfflineBanner = useOfflineBanner();
 *   // Inside JSX, before <header>:
 *   {OfflineBanner}
 */
export function useOfflineBanner(): React.ReactElement | null {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        background:     '#1e293b',
        color:          '#f8fafc',
        fontSize:       12,
        fontWeight:     600,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            8,
        padding:        '8px 16px',
        letterSpacing:  '.03em',
        zIndex:         400,
        flexShrink:     0,
      }}
    >
      <span style={{ fontSize: 14 }}>📡</span>
      You're offline — showing cached data
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. INDEXEDDB WRAPPER
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME    = 'pesapro';
const DB_VERSION = 1;

/** Store names */
const STORES = {
  transactions: 'transactions',
  syncQueue:    'syncQueue',
  meta:         'meta',
} as const;

/** Opens (or upgrades) the IndexedDB database. Returns a promise of IDBDatabase. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;

      // Transactions store — keyed by transaction id
      if (!db.objectStoreNames.contains(STORES.transactions)) {
        const txStore = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
        txStore.createIndex('date',     'date',     { unique: false });
        txStore.createIndex('type',     'type',     { unique: false });
        txStore.createIndex('category', 'category', { unique: false });
      }

      // Sync queue — auto-increment key, holds pending writes
      if (!db.objectStoreNames.contains(STORES.syncQueue)) {
        db.createObjectStore(STORES.syncQueue, { keyPath: 'qid', autoIncrement: true });
      }

      // Meta store — last sync time, schema version, etc.
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

/** Generic helper: run a callback inside a transaction and resolve with its result. */
async function withStore<T>(
  storeName: string,
  mode:      IDBTransactionMode,
  callback:  (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db    = await openDB();
  const tx    = db.transaction(storeName, mode);
  const store = tx.objectStore(storeName);

  return new Promise<T>((resolve, reject) => {
    const req  = callback(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. CACHED TRANSACTIONS API
// ─────────────────────────────────────────────────────────────────────────────

export const cachedTransactions = {
  /**
   * Persist a batch of transactions to IndexedDB.
   * Uses "put" so re-importing the same transactions is idempotent.
   */
  async saveAll(transactions: ParsedTransaction[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction(STORES.transactions, 'readwrite');
    const store = tx.objectStore(STORES.transactions);

    for (const t of transactions) {
      // Ensure every record has an id; fall back to a hash of key fields
      const record = {
        ...t,
        id: t.transaction_code ?? `${t.date}-${t.amount}-${t.type}`,
      };
      store.put(record);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror    = () => reject(tx.error);
    });
  },

  /** Read all cached transactions (no network required). */
  async getAll(): Promise<ParsedTransaction[]> {
    return withStore<ParsedTransaction[]>(
      STORES.transactions,
      'readonly',
      store => store.getAll() as IDBRequest<ParsedTransaction[]>,
    );
  },

  /** Read transactions filtered by date range. */
  async getByDateRange(from: Date, to: Date): Promise<ParsedTransaction[]> {
    const all = await cachedTransactions.getAll();
    return all.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date);
      return d >= from && d <= to;
    });
  },

  /** Delete a single transaction by id. */
  async delete(id: string): Promise<void> {
    await withStore(STORES.transactions, 'readwrite', store => store.delete(id));
  },

  /** Wipe all cached transactions (e.g. on sign-out). */
  async clear(): Promise<void> {
    await withStore(STORES.transactions, 'readwrite', store => store.clear());
  },

  /** Returns the count of cached transactions. */
  async count(): Promise<number> {
    return withStore<number>(
      STORES.transactions,
      'readonly',
      store => store.count() as IDBRequest<number>,
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. SYNC QUEUE — offline writes that replay when connectivity returns
// ─────────────────────────────────────────────────────────────────────────────

export type SyncOperation =
  | { action: 'updateCategory'; id: string; category: string }
  | { action: 'flagReview';     id: string; flag: boolean    }
  | { action: 'addNote';        id: string; note: string     }
  | { action: 'deleteTransaction'; id: string               };

export interface QueuedItem {
  qid?:      number;         // auto-assigned by IndexedDB
  operation: SyncOperation;
  timestamp: string;         // ISO string
  retries:   number;
}

export const syncQueue = {
  /** Push an offline write to the queue. */
  async enqueue(operation: SyncOperation): Promise<void> {
    const item: QueuedItem = {
      operation,
      timestamp: new Date().toISOString(),
      retries:   0,
    };
    await withStore(STORES.syncQueue, 'readwrite', store => store.add(item));
    // Ask the service worker to flush when it can
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SYNC_QUEUE_UPDATED' });
    }
  },

  /** Read all pending queued items. */
  async getAll(): Promise<QueuedItem[]> {
    return withStore<QueuedItem[]>(
      STORES.syncQueue,
      'readonly',
      store => store.getAll() as IDBRequest<QueuedItem[]>,
    );
  },

  /** Remove a successfully synced item by its auto-increment key. */
  async remove(qid: number): Promise<void> {
    await withStore(STORES.syncQueue, 'readwrite', store => store.delete(qid));
  },

  /** Flush all queued items by calling your API. Pass your real API function. */
  async flush(
    apiCall: (op: SyncOperation) => Promise<void>,
  ): Promise<{ succeeded: number; failed: number }> {
    const items = await syncQueue.getAll();
    let succeeded = 0;
    let failed    = 0;

    for (const item of items) {
      try {
        await apiCall(item.operation);
        await syncQueue.remove(item.qid!);
        succeeded++;
      } catch {
        // Increment retry count but leave in queue
        const db    = await openDB();
        const tx    = db.transaction(STORES.syncQueue, 'readwrite');
        const store = tx.objectStore(STORES.syncQueue);
        store.put({ ...item, retries: item.retries + 1 });
        failed++;
      }
    }

    return { succeeded, failed };
  },

  /** Count pending items — useful for a "pending sync" badge. */
  async count(): Promise<number> {
    return withStore<number>(
      STORES.syncQueue,
      'readonly',
      store => store.count() as IDBRequest<number>,
    );
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. META STORE — last sync time, etc.
// ─────────────────────────────────────────────────────────────────────────────

export const meta = {
  async set(key: string, value: unknown): Promise<void> {
    await withStore(STORES.meta, 'readwrite', store => store.put({ key, value }));
  },

  async get<T>(key: string): Promise<T | undefined> {
    const row = await withStore<{ key: string; value: T } | undefined>(
      STORES.meta,
      'readonly',
      store => store.get(key) as IDBRequest<{ key: string; value: T } | undefined>,
    );
    return row?.value;
  },

  async setLastSynced(): Promise<void> {
    await meta.set('lastSynced', new Date().toISOString());
  },

  async getLastSynced(): Promise<Date | undefined> {
    const v = await meta.get<string>('lastSynced');
    return v ? new Date(v) : undefined;
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// 7. OFFLINE-FIRST TRANSACTION HOOK
// ─────────────────────────────────────────────────────────────────────────────

/**
 * useOfflineTransactions
 *
 * Loads transactions from IndexedDB immediately (no network wait),
 * then merges in any fresh data you pass (e.g. from an SMS import).
 *
 * Usage in DashboardPage.tsx:
 *   const { transactions, pendingCount, lastSynced } =
 *     useOfflineTransactions(freshFromSMS);
 */
export function useOfflineTransactions(fresh: ParsedTransaction[] = []) {
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSynced,   setLastSynced  ] = useState<Date | undefined>();

  // Load cache on mount
  useEffect(() => {
    cachedTransactions.getAll().then(cached => {
      if (cached.length > 0) setTransactions(cached);
    });

    syncQueue.count().then(setPendingCount);
    meta.getLastSynced().then(setLastSynced);
  }, []);

  // Merge fresh (SMS import) data in and persist
  useEffect(() => {
    if (fresh.length === 0) return;

    setTransactions(prev => {
      const existing = new Map(prev.map(t => [t.transaction_code ?? `${t.date}-${t.amount}-${t.type}`, t]));
      for (const t of fresh) {
        existing.set(t.transaction_code ?? `${t.date}-${t.amount}-${t.type}`, t);
      }
      const merged = [...existing.values()];
      // Persist merged set
      cachedTransactions.saveAll(merged);
      meta.setLastSynced();
      return merged;
    });
  }, [fresh]);

  return { transactions, pendingCount, lastSynced };
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. SERVICE WORKER REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Call once in your app entry point (main.tsx / index.tsx):
 *
 *   import { registerServiceWorker } from './offline';
 *   registerServiceWorker();
 *
 * You also need a public/sw.js file — see the template below.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => {
        console.log('[PesaPro] Service worker registered', reg.scope);

        // Flush sync queue when we come back online
        window.addEventListener('online', async () => {
          const pending = await syncQueue.getAll();
          if (pending.length > 0) {
            console.log(`[PesaPro] Back online — ${pending.length} queued items to sync`);
            // syncQueue.flush(yourApiFunction) — wire up your real API here
          }
        });
      })
      .catch(err => console.warn('[PesaPro] SW registration failed:', err));
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SERVICE WORKER TEMPLATE — save as public/sw.js
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * const CACHE = 'pesapro-v1';
 * const PRECACHE = [
 *   '/', '/index.html', '/manifest.json',
 *   // add your built JS/CSS chunks here after a production build
 * ];
 *
 * self.addEventListener('install', e => {
 *   e.waitUntil(
 *     caches.open(CACHE).then(c => c.addAll(PRECACHE))
 *   );
 *   self.skipWaiting();
 * });
 *
 * self.addEventListener('activate', e => {
 *   e.waitUntil(
 *     caches.keys().then(keys =>
 *       Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
 *     )
 *   );
 *   self.clients.claim();
 * });
 *
 * // Cache-first for static assets, network-first for API calls
 * self.addEventListener('fetch', e => {
 *   const url = new URL(e.request.url);
 *
 *   // Skip non-GET and cross-origin requests
 *   if (e.request.method !== 'GET' || url.origin !== location.origin) return;
 *
 *   // API calls: network-first, fall back to cache
 *   if (url.pathname.startsWith('/api/')) {
 *     e.respondWith(
 *       fetch(e.request)
 *         .then(res => {
 *           const clone = res.clone();
 *           caches.open(CACHE).then(c => c.put(e.request, clone));
 *           return res;
 *         })
 *         .catch(() => caches.match(e.request))
 *     );
 *     return;
 *   }
 *
 *   // Static assets: cache-first
 *   e.respondWith(
 *     caches.match(e.request).then(cached => cached ?? fetch(e.request))
 *   );
 * });
 *
 * // Background Sync — fires when connectivity returns
 * self.addEventListener('sync', e => {
 *   if (e.tag === 'pesapro-sync') {
 *     // The flush logic lives in the app via postMessage
 *     e.waitUntil(self.clients.matchAll().then(clients =>
 *       clients.forEach(c => c.postMessage({ type: 'FLUSH_QUEUE' }))
 *     ));
 *   }
 * });
 */
