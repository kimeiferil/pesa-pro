import { supabase } from '../lib/supabase';

export interface AppVersion {
  id: string;
  version: string;
  release_date: string;
  is_required: boolean;
  changelog: string;
  download_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  isRequired: boolean;
  currentVersion: string;
  latestVersion: string;
  changelog: string;
  downloadUrl?: string;
  releaseDate: string;
}

const CURRENT_APP_VERSION = '1.0.0'; // Update this with each release
const VERSION_CHECK_INTERVAL = 1000 * 60 * 60; // 1 hour

class UpdateService {
  private lastCheckTime = 0;
  private cachedUpdateInfo: UpdateCheckResult | null = null;

  /**
   * Check for app updates from Supabase
   */
  async checkForUpdates(): Promise<UpdateCheckResult> {
    try {
      // Use cache if checked recently
      const now = Date.now();
      if (this.cachedUpdateInfo && now - this.lastCheckTime < VERSION_CHECK_INTERVAL) {
        return this.cachedUpdateInfo;
      }

      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.warn('Update check failed:', error);
        return {
          hasUpdate: false,
          isRequired: false,
          currentVersion: CURRENT_APP_VERSION,
          latestVersion: CURRENT_APP_VERSION,
          changelog: '',
          releaseDate: new Date().toISOString(),
        };
      }

      const latestVersion = data as AppVersion;
      const hasUpdate = this.compareVersions(latestVersion.version, CURRENT_APP_VERSION) > 0;

      const result: UpdateCheckResult = {
        hasUpdate,
        isRequired: latestVersion.is_required && hasUpdate,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: latestVersion.version,
        changelog: latestVersion.changelog,
        downloadUrl: latestVersion.download_url,
        releaseDate: latestVersion.release_date,
      };

      this.lastCheckTime = now;
      this.cachedUpdateInfo = result;

      return result;
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        hasUpdate: false,
        isRequired: false,
        currentVersion: CURRENT_APP_VERSION,
        latestVersion: CURRENT_APP_VERSION,
        changelog: '',
        releaseDate: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current app version
   */
  getCurrentVersion(): string {
    return CURRENT_APP_VERSION;
  }

  /**
   * Fetch all version history
   */
  async getVersionHistory(): Promise<AppVersion[]> {
    try {
      const { data, error } = await supabase
        .from('app_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as AppVersion[];
    } catch (error) {
      console.error('Error fetching version history:', error);
      return [];
    }
  }

  /**
   * Compare two semantic versions
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  private compareVersions(v1: string, v2: string): number {
    const parse = (v: string) => v.split('.').map(x => parseInt(x, 10));
    const arr1 = parse(v1);
    const arr2 = parse(v2);

    for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
      const num1 = arr1[i] || 0;
      const num2 = arr2[i] || 0;
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  /**
   * Clear cache to force fresh check
   */
  clearCache(): void {
    this.cachedUpdateInfo = null;
    this.lastCheckTime = 0;
  }

  /**
   * Set version as acknowledged (stored in localStorage)
   */
  acknowledgeUpdate(version: string): void {
    localStorage.setItem('acknowledged_version', version);
  }

  /**
   * Get acknowledged version
   */
  getAcknowledgedVersion(): string {
    return localStorage.getItem('acknowledged_version') || '';
  }

  /**
   * Check if user has already seen this update
   */
  hasSeenUpdate(version: string): boolean {
    return this.getAcknowledgedVersion() === version;
  }

  /**
   * Defer update check (don't remind for 24 hours)
   */
  deferUpdateReminder(): void {
    localStorage.setItem('deferred_update_time', Date.now().toString());
  }

  /**
   * Check if update reminder is deferred
   */
  isUpdateDeferred(): boolean {
    const deferredTime = localStorage.getItem('deferred_update_time');
    if (!deferredTime) return false;

    const now = Date.now();
    const deferredUntil = parseInt(deferredTime, 10) + (1000 * 60 * 60 * 24); // 24 hours
    return now < deferredUntil;
  }
}

export const updateService = new UpdateService();
