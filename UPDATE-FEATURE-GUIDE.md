# Pesa Pro Update Feature Implementation Guide

## Overview

The update feature provides a complete system for managing application versions, notifying users of updates, and handling both web and mobile deployment scenarios.

## Features

- **Automatic Update Checking**: Checks for new versions at startup and on regular intervals
- **Version Management**: Track all versions with changelogs and release dates
- **Required Updates**: Force critical security/stability updates
- **Flexible Notifications**: Customizable notifications with optional deferral
- **Offline Support**: Update checks cached for offline scenarios
- **Admin Panel**: Version management interface for administrators
- **Version History**: Users can view all previous versions

## Components & Services

### 1. **updateService** (`src/services/updateService.ts`)

Core service for all update operations.

**Key Methods:**
- `checkForUpdates()`: Fetch latest version from Supabase
- `getCurrentVersion()`: Get current app version
- `getVersionHistory()`: Fetch all versions
- `compareVersions(v1, v2)`: Compare semantic versions
- `acknowledgeUpdate(version)`: Mark version as seen
- `hasSeenUpdate(version)`: Check if user acknowledged update
- `isUpdateDeferred()`: Check if reminder is deferred
- `deferUpdateReminder()`: Defer notification for 24 hours

### 2. **useUpdateChecker Hook** (`src/hooks/useUpdateChecker.ts`)

React hook for managing update checks in components.

```tsx
const {
  updateInfo,           // Current update information
  isChecking,          // Loading state
  error,               // Error messages
  showNotification,    // Show/hide modal
  checkForUpdates,     // Manual check trigger
  handleUpdateAcknowledged,
  handleDeferUpdate,
  handleForceCheckNow,
} = useUpdateChecker({
  checkOnMount: true,
  autoCheckInterval: 1000 * 60 * 60, // 1 hour
});
```

### 3. **UpdateNotification Component** (`src/components/UpdateNotification.tsx`)

Modal UI for displaying update notifications.

```tsx
<UpdateNotification
  update={updateInfo}
  isOpen={showNotification}
  onClose={handleClose}
  onUpdate={handleUpdate}
  isRequired={updateInfo?.isRequired}
/>
```

### 4. **VersionHistoryPage** (`src/pages/VersionHistoryPage.tsx`)

Display version history to users.

### 5. **VersionManagementPanel** (`src/components/VersionManagementPanel.tsx`)

Admin panel for managing versions (add, edit, delete).

## Database Setup

### Run Migration

```bash
# Execute the migration in Supabase console or via CLI
supabase migration up
```

Or manually run the SQL from `supabase/migrations/20260518_create_app_versions.sql`

### Table Structure

```sql
app_versions (
  id UUID PRIMARY KEY
  version VARCHAR(50) UNIQUE
  release_date TIMESTAMP
  is_required BOOLEAN
  changelog TEXT
  download_url VARCHAR(500)
  created_at TIMESTAMP
  updated_at TIMESTAMP
)
```

## Integration Steps

### 1. Add to App.tsx

```tsx
import { useUpdateChecker } from './hooks/useUpdateChecker';
import UpdateNotification from './components/UpdateNotification';

function AppContent() {
  const {
    updateInfo,
    showNotification,
    setShowNotification,
    handleUpdateAcknowledged,
    handleDeferUpdate,
  } = useUpdateChecker({
    checkOnMount: true,
    autoCheckInterval: 1000 * 60 * 60,
  });

  return (
    <>
      {/* Your existing content */}
      
      <UpdateNotification
        update={updateInfo}
        isOpen={showNotification}
        onClose={() => {
          handleDeferUpdate();
          setShowNotification(false);
        }}
        onUpdate={handleUpdateAcknowledged}
        isRequired={updateInfo?.isRequired}
      />
    </>
  );
}
```

### 2. Update Version Number

In `src/services/updateService.ts`, update `CURRENT_APP_VERSION`:

```tsx
const CURRENT_APP_VERSION = '1.0.0'; // Update with each release
```

### 3. Add to Settings Page

Include the version management panel in admin settings or settings page:

```tsx
import VersionManagementPanel from '../components/VersionManagementPanel';

<VersionManagementPanel />
```

### 4. Add Version History Link in Settings

```tsx
<button onClick={() => navigate('/version-history')}>
  Version History
</button>
```

Add route:
```tsx
<Route path="/version-history" element={<VersionHistoryPage currentVersion={currentVersion} />} />
```

## Publishing New Versions

### Step 1: Update Version Number
```tsx
// src/services/updateService.ts
const CURRENT_APP_VERSION = '1.0.1';
```

### Step 2: Build & Deploy Web
```bash
npm run build
# Deploy to your hosting platform
```

### Step 3: Add Version to Database

Use Admin Panel (`VersionManagementPanel`) or insert via SQL:

```sql
INSERT INTO app_versions (version, changelog, is_required, download_url)
VALUES (
  '1.0.1',
  'Bug fixes and performance improvements',
  false,
  'https://your-app-url.com'
);
```

### Step 4: For Mobile (Android)

**Options:**
1. **CodePush (Microsoft AppCenter)** - OTA updates
2. **Google Play Store** - Traditional app store
3. **Firebase App Distribution** - Beta testing

See "Mobile Deployment" section below.

## Hosting Recommendations

### Current Setup Analysis

Your app uses:
- **Web**: React + Vite + TypeScript
- **Mobile**: Capacitor (Android)
- **Backend**: Supabase (PostgreSQL)
- **Package Manager**: Bun

### Option 1: **Supabase (RECOMMENDED)**

**Pros:**
- Already using for backend
- Integrated auth & storage
- PostgreSQL databases included
- Edge functions for API logic
- Real-time capabilities
- Affordable pricing
- Included edge caching

**Cons:**
- Less familiar for some developers

**Setup:**
```bash
# Enable supabase hosting
supabase projects list
# Deploy web app via Vercel connected to Supabase
```

**Best for:** Seamless backend-frontend integration

### Option 2: **Vercel**

**Pros:**
- Optimized for Next.js/React
- Extremely fast (edge network)
- Free tier available
- Automatic preview deployments
- Environment variables management
- Analytics built-in

**Cons:**
- Separate from Supabase backend
- Need to manage API layer

**Setup:**
```bash
npm run build
# Connect GitHub → Vercel → Auto deploy
```

**Cost:** Free tier + $20/month for production features

### Option 3: **Firebase Hosting**

**Pros:**
- If already using Firebase elsewhere
- CDN included
- SSL automatic
- Free tier generous
- Good integration with Firebase Functions

**Cons:**
- Would need Firebase alongside Supabase
- More complex architecture

**Setup:**
```bash
npm install -g firebase-tools
firebase init hosting
firebase deploy
```

### Option 4: **GitHub Pages + GitHub Actions (Minimal Cost)**

**Pros:**
- Completely free
- GitHub integrated
- Good for static/SPA apps
- Unlimited bandwidth

**Cons:**
- No server-side logic
- Basic CI/CD
- GitHub's domain only (or custom)

**Setup:**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Option 5: **Self-Hosted (AWS/DigitalOcean)**

**Pros:**
- Full control
- Scalable
- Can handle complex requirements

**Cons:**
- DevOps overhead
- More expensive
- Maintenance required

## Recommended Architecture

### For Web:
```
Vercel
  ↓
SPA (React app)
  ↓
Supabase (Backend API)
  ↓
PostgreSQL
```

### For Mobile (Android):
```
CodePush / Firebase Distribution
  ↓
Android APK
  ↓
Supabase (Backend)
  ↓
PostgreSQL
```

## Implementation Steps

### 1. Run Database Migration
```bash
# In Supabase console, run the migration SQL
```

### 2. Update App.tsx
Add update checker hook and notification component (see "Integration Steps" above)

### 3. Update Version Number
```tsx
const CURRENT_APP_VERSION = '1.0.0'; // in updateService.ts
```

### 4. Add Settings Integration
Add version management panel to admin/settings page

### 5. Deploy to Vercel
```bash
# Create Vercel account, connect GitHub
npm run build
# Vercel auto-deploys on git push
```

### 6. Configure Environment
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Testing Update Flow

### Simulate Update Available:
```tsx
// In browser console
localStorage.setItem('acknowledged_version', '0.9.0');
// Then reload - should show update notification
```

### Manual Check:
```tsx
import { updateService } from './services/updateService';
await updateService.checkForUpdates();
```

## Version Numbering (SemVer)

```
MAJOR.MINOR.PATCH
  1   .  0   .  0

MAJOR: Breaking changes, major features
MINOR: New features, backwards compatible
PATCH: Bug fixes
```

Examples:
- `1.0.0` - First release
- `1.1.0` - New feature added
- `1.1.1` - Bug fix
- `2.0.0` - Major breaking change

## Mobile Deployment (Capacitor)

### Build for Android:
```bash
npm run build
npx cap copy android
npx cap open android
# Build in Android Studio
```

### Deploy Options:

#### 1. CodePush (OTA Updates)
```bash
npm install -g appcenter-cli
appcenter codepush deployment add -a YourOrg/YourApp
# Update React code without app store review
```

#### 2. Google Play Store
Upload APK/AAB to Google Play Console

#### 3. Firebase App Distribution
```bash
firebase appdistribution:distribute app.apk \
  --release-notes "Bug fixes" \
  --testers-file testers.txt
```

## Monitoring

### Track Update Success:
```tsx
// Add analytics
analytics.logEvent('app_update_checked', {
  current_version: updateService.getCurrentVersion(),
  has_update: updateInfo.hasUpdate,
});
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Update check timeout | Increase timeout in `updateService` |
| Version comparison fails | Check semantic versioning format |
| Modal not showing | Verify `showNotification` state in App.tsx |
| Database permission denied | Check Supabase RLS policies |
| Cache issue | Use `updateService.clearCache()` |

## Summary

✅ **Quick Start:**
1. Run the migration
2. Integrate into App.tsx
3. Deploy to Vercel
4. Add new versions via admin panel

🎯 **Recommended Hosting:**
- **Web:** Vercel (+ Supabase for backend)
- **Mobile:** Google Play Store + CodePush for hot fixes

📦 **Architecture:**
- Clean separation of concerns
- Offline-first with caching
- Zero-downtime deployments
- Admin version management
