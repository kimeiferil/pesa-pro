import { supabase } from '../lib/supabase';

export interface AppVersion {
  id: string;
  version: string;
  is_required: boolean;
  changelog: string;
  download_url: string | null;
  release_date: string;
  created_at: string;
}

export interface CreateVersionPayload {
  version: string;
  is_required: boolean;
  changelog: string;
  download_url: string | null;
  release_date: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  isRequired: boolean;
  latestVersion: string | null;
  currentVersion: string;
  changelog: string | null;
  downloadUrl: string | null;
  releaseDate: string | null;
}

// ── helpers ────────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0'; // Keep in sync with App.tsx

const isNewer = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }) > 0;

const CACHE_KEY_SEEN     = 'update_seen_version';
const CACHE_KEY_DEFERRED = 'update_deferred_until';

// ── UpdateService ──────────────────────────────────────────────────────────
class UpdateService {
  /**
   * Fetch all versions, newest first.
   */
  async getVersionHistory(): Promise<AppVersion[]> {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('release_date', { ascending: false });

    if (error) throw error;
    return (data ?? []) as AppVersion[];
  }

  /**
   * Fetch only the latest version record.
   */
  async getLatestVersion(): Promise<AppVersion | null> {
    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .order('release_date', { ascending: false })
      .limit(1)
      .single();

    if (error) return null;
    return data as AppVersion;
  }

  /**
   * Check whether a newer version exists and return a structured result.
   * Used by useUpdateChecker.
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    const latest = await this.getLatestVersion();

    if (!latest) {
      return {
        hasUpdate: false,
        isRequired: false,
        latestVersion: null,
        currentVersion: APP_VERSION,
        changelog: null,
        downloadUrl: null,
        releaseDate: null,
      };
    }

    const hasUpdate = isNewer(latest.version, APP_VERSION);

    return {
      hasUpdate,
      isRequired: hasUpdate ? latest.is_required : false,
      latestVersion: latest.version,
      currentVersion: APP_VERSION,
      changelog: hasUpdate ? latest.changelog : null,
      downloadUrl: hasUpdate ? latest.download_url : null,
      releaseDate: hasUpdate ? latest.release_date : null,
    };
  }

  /**
   * Returns true if the user has already seen a notification for this version.
   */
  hasSeenUpdate(version: string): boolean {
    try {
      return localStorage.getItem(CACHE_KEY_SEEN) === version;
    } catch {
      return false;
    }
  }

  /**
   * Returns true if the user deferred the reminder and the deferral is still active.
   */
  isUpdateDeferred(): boolean {
    try {
      const until = localStorage.getItem(CACHE_KEY_DEFERRED);
      if (!until) return false;
      return Date.now() < parseInt(until, 10);
    } catch {
      return false;
    }
  }

  /**
   * Mark a version as acknowledged so we don't show the banner again.
   */
  acknowledgeUpdate(version: string): void {
    try {
      localStorage.setItem(CACHE_KEY_SEEN, version);
    } catch {}
  }

  /**
   * Defer the update reminder for a given number of hours (default 24).
   */
  deferUpdateReminder(hours = 24): void {
    try {
      const until = Date.now() + hours * 60 * 60 * 1000;
      localStorage.setItem(CACHE_KEY_DEFERRED, String(until));
    } catch {}
  }

  /**
   * Clear all cached update state (seen + deferred).
   */
  clearCache(): void {
    try {
      localStorage.removeItem(CACHE_KEY_SEEN);
      localStorage.removeItem(CACHE_KEY_DEFERRED);
    } catch {}
  }

  /**
   * Create a new version (admin only).
   */
  async createVersion(payload: CreateVersionPayload): Promise<AppVersion> {
    const { data, error } = await supabase
      .from('app_versions')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data as AppVersion;
  }

  /**
   * Update an existing version record (admin only).
   */
  async updateVersion(id: string, payload: Partial<CreateVersionPayload>): Promise<AppVersion> {
    const { data, error } = await supabase
      .from('app_versions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as AppVersion;
  }

  /**
   * Delete a version record (admin only).
   */
  async deleteVersion(id: string): Promise<void> {
    const { error } = await supabase
      .from('app_versions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
}

export const updateService = new UpdateService();