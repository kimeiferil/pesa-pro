import { useEffect, useState, useCallback } from 'react';
import { updateService, type UpdateCheckResult } from '../services/updateService';

interface UseUpdateCheckerOptions {
  checkOnMount?: boolean;
  autoCheckInterval?: number; // in milliseconds
  onUpdateFound?: (update: UpdateCheckResult) => void;
}

/**
 * Hook to manage app update checking and notifications
 */
export function useUpdateChecker(options: UseUpdateCheckerOptions = {}) {
  const {
    checkOnMount = true,
    autoCheckInterval = 1000 * 60 * 60, // 1 hour
    onUpdateFound,
  } = options;

  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState(false);

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    setError(null);

    try {
      const update = await updateService.checkForUpdates();
      setUpdateInfo(update);

      if (update.hasUpdate && !updateService.hasSeenUpdate(update.latestVersion)) {
        if (!updateService.isUpdateDeferred()) {
          setShowNotification(true);
          onUpdateFound?.(update);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check for updates';
      setError(message);
      console.error('Update check error:', err);
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, onUpdateFound]);

  // Check on mount
  useEffect(() => {
    if (checkOnMount) {
      checkForUpdates();
    }
  }, [checkOnMount, checkForUpdates]);

  // Auto-check interval
  useEffect(() => {
    if (!autoCheckInterval) return;

    const interval = setInterval(() => {
      checkForUpdates();
    }, autoCheckInterval);

    return () => clearInterval(interval);
  }, [autoCheckInterval, checkForUpdates]);

  const handleUpdateAcknowledged = useCallback(() => {
    if (updateInfo) {
      updateService.acknowledgeUpdate(updateInfo.latestVersion);
    }
  }, [updateInfo]);

  const handleDeferUpdate = useCallback(() => {
    updateService.deferUpdateReminder();
    setShowNotification(false);
  }, []);

  const handleForceCheckNow = useCallback(() => {
    updateService.clearCache();
    checkForUpdates();
  }, [checkForUpdates]);

  return {
    updateInfo,
    isChecking,
    error,
    showNotification,
    setShowNotification,
    checkForUpdates,
    handleUpdateAcknowledged,
    handleDeferUpdate,
    handleForceCheckNow,
  };
}

export default useUpdateChecker;
