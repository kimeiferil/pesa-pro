import { saveTransaction } from '../features/transactions/transactionService';
import { addContributionToCampaign } from '../features/campaigns/campaignService';
import type { ParsedTransaction } from '../shared/mpesaParser';

const QUEUE_KEY = 'pesapro_pending_sync';

export interface PendingSyncItem {
  id: string;
  type: 'transaction';
  data: ParsedTransaction;
  campaignId?: number;
  timestamp: number;
}

export const getSyncQueue = (): PendingSyncItem[] => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load sync queue', e);
    return [];
  }
};

const saveSyncQueue = (queue: PendingSyncItem[]) => {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const addToSyncQueue = (data: ParsedTransaction, campaignId?: number) => {
  const queue = getSyncQueue();
  const newItem: PendingSyncItem = {
    id: Math.random().toString(36).substring(2, 9),
    type: 'transaction',
    data,
    campaignId,
    timestamp: Date.now(),
  };
  queue.push(newItem);
  saveSyncQueue(queue);
  return newItem;
};

export const processSyncQueue = async () => {
  const queue = getSyncQueue();
  if (queue.length === 0) return;

  console.log(`Processing sync queue: ${queue.length} items remaining`);

  const remaining: PendingSyncItem[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'transaction') {
        await saveTransaction(item.data, item.campaignId);
        if (item.campaignId && item.data.amount) {
          await addContributionToCampaign(
            item.campaignId,
            item.data.amount,
            item.data.name ?? 'Anonymous',
            item.data.phone ?? '',
            item.data.transaction_code ?? ''
          );
        }
      }
    } catch (e) {
      console.error('Failed to sync item', item.id, e);
      remaining.push(item); // Keep in queue for next try
    }
  }

  saveSyncQueue(remaining);
  return queue.length - remaining.length; // Number of synced items
};
