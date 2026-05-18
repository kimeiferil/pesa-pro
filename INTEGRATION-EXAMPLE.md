/**
 * INTEGRATION EXAMPLE: Adding Update Feature to App.tsx
 * 
 * This file shows exactly how to integrate the update checking feature
 * into your existing App.tsx
 */

// ============ ADD THESE IMPORTS AT THE TOP ============
import { useUpdateChecker } from './hooks/useUpdateChecker';
import UpdateNotification from './components/UpdateNotification';

// ============ UPDATE FEATURE CODE ============
// Add this inside your main App component or create a wrapper

function AppWithUpdateFeature() {
  // Initialize update checker hook
  const {
    updateInfo,
    isChecking,
    error,
    showNotification,
    setShowNotification,
    handleUpdateAcknowledged,
    handleDeferUpdate,
  } = useUpdateChecker({
    checkOnMount: true,
    autoCheckInterval: 1000 * 60 * 60, // Check every hour
  });

  // Your existing app code...
  
  return (
    <>
      {/* Your existing app content */}
      <YourExistingApp />
      
      {/* Update Notification Modal - ADD THIS */}
      <UpdateNotification
        update={updateInfo}
        isOpen={showNotification}
        onClose={() => {
          handleDeferUpdate();
          setShowNotification(false);
        }}
        onUpdate={handleUpdateAcknowledged}
        isRequired={updateInfo?.isRequired || false}
      />
    </>
  );
}

// ============ EXAMPLE: Full App.tsx Integration ============
/**
 * 
import React, { useEffect, useState, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './lib/supabase';
import { processSyncQueue } from './lib/syncQueue';

// NEW: Update Feature Imports
import { useUpdateChecker } from './hooks/useUpdateChecker';
import UpdateNotification from './components/UpdateNotification';

// ... rest of existing imports ...

// ... existing code ...

function AppContent() {
  const { user } = useAuth();
  const transactions = useTransactions();
  const location = useLocation();
  const navigate = useNavigate();
  
  // NEW: Initialize update checker
  const {
    updateInfo,
    showNotification,
    setShowNotification,
    handleUpdateAcknowledged,
    handleDeferUpdate,
  } = useUpdateChecker({
    checkOnMount: true,
    autoCheckInterval: 1000 * 60 * 60, // 1 hour
    onUpdateFound: (update) => {
      console.log('Update found:', update);
      // Optional: Send analytics
      // analytics.logEvent('update_available', { version: update.latestVersion });
    },
  });

  return (
    <AnimatePresence mode="wait">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {!NO_NAV_ROUTES.includes(location.pathname) && <Sidebar />}

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* ... rest of your routes ... */}
            
            <Route path="/dashboard" element={<ProtectedRoute><DashboardRoute transactions={transactions} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>

        {!NO_NAV_ROUTES.includes(location.pathname) && <BottomNav />}
        
        {/* NEW: Add Update Notification Modal */}
        <UpdateNotification
          update={updateInfo}
          isOpen={showNotification}
          onClose={() => {
            handleDeferUpdate();
            setShowNotification(false);
          }}
          onUpdate={handleUpdateAcknowledged}
          isRequired={updateInfo?.isRequired || false}
        />
      </div>
    </AnimatePresence>
  );
}

export default AppContent;

*/

// ============ EXAMPLE: Settings Page Integration ============
/**
 * 
// In src/pages/SettingsPage.tsx

import { VersionHistoryPage } from '../pages/VersionHistoryPage';
import { updateService } from '../services/updateService';

function SettingsPage() {
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  
  const handleCheckUpdatesNow = async () => {
    updateService.clearCache();
    await updateService.checkForUpdates();
    // Update notification will show if available
  };

  if (showVersionHistory) {
    return (
      <VersionHistoryPage
        onBack={() => setShowVersionHistory(false)}
        currentVersion={updateService.getCurrentVersion()}
      />
    );
  }

  return (
    <div>
      {/* Existing settings ... */}
      
      {/* NEW: Update Settings Section */}
      <div style={{ marginTop: 20 }}>
        <h3>App Version</h3>
        <p>Current: v{updateService.getCurrentVersion()}</p>
        
        <button onClick={handleCheckUpdatesNow}>
          Check for Updates Now
        </button>
        
        <button onClick={() => setShowVersionHistory(true)}>
          View Version History
        </button>
      </div>
    </div>
  );
}

*/

// ============ EXAMPLE: Admin Panel Integration ============
/**
 * 
// In src/pages/AdminPanel.tsx

import { VersionManagementPanel } from '../components/VersionManagementPanel';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div>
      <nav>
        <button onClick={() => setActiveTab('general')}>General</button>
        <button onClick={() => setActiveTab('versions')}>Versions</button>
        {/* other tabs */}
      </nav>

      {activeTab === 'versions' && <VersionManagementPanel />}
      {/* other tab content */}
    </div>
  );
}

*/

// ============ TESTING LOCALLY ============
/**
 * 
// Test the update feature in development:

// 1. In browser console, simulate an update:
localStorage.setItem('acknowledged_version', '0.9.0');
// Reload page - should show update modal

// 2. Test deferred updates:
updateService.deferUpdateReminder();
// Update won't show for 24 hours

// 3. Force check:
updateService.clearCache();
await updateService.checkForUpdates();

// 4. Check current version:
console.log(updateService.getCurrentVersion()); // 1.0.0

// 5. View cached update info:
console.log(updateService.cachedUpdateInfo);

*/

// ============ DEPLOYING UPDATES ============
/**
 * 
When you want to release a new version:

1. Update version in updateService.ts:
   const CURRENT_APP_VERSION = '1.0.1';

2. Build and commit:
   npm run build
   git add .
   git commit -m "Release v1.0.1"
   git push origin main
   # Vercel auto-deploys

3. Add version to database (via Admin Panel):
   - Visit admin panel
   - Click "Add New Version"
   - Enter version: 1.0.1
   - Add changelog
   - Set isRequired if needed
   - Click Save

4. Users will see update notification on next login

5. For mobile (Android):
   - Build APK/AAB
   - Upload to Google Play Store
   - Setup CodePush for hot fixes (optional)

*/

export default AppWithUpdateFeature;
