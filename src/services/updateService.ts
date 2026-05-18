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

class UpdateService {
  /**
   * Fetch all versions, newest first.
   * Used by VersionHistoryPage to show the full list.
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
   * Used by useAppVersionCheck in App.tsx.
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