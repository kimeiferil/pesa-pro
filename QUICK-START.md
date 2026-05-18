# Pesa Pro Update Feature - Quick Start Guide

## ⚡ 5-Minute Setup

### Step 1: Run Database Migration (2 min)

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your "Pesa Pro" project
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy-paste the SQL from: `supabase/migrations/20260518_create_app_versions.sql`
6. Click **Run**
7. ✅ Done! Table created

### Step 2: Add to App.tsx (2 min)

Open `src/App.tsx` and add these imports at the top:

```tsx
import { useUpdateChecker } from './hooks/useUpdateChecker';
import UpdateNotification from './components/UpdateNotification';
```

Find your main `<AppContent>` or main component function and add:

```tsx
function AppContent() {
  // ... existing code ...

  // NEW: Add update checker
  const {
    updateInfo,
    showNotification,
    setShowNotification,
    handleUpdateAcknowledged,
    handleDeferUpdate,
  } = useUpdateChecker({
    checkOnMount: true,
    autoCheckInterval: 1000 * 60 * 60, // 1 hour
  });

  return (
    <>
      {/* ... your existing JSX ... */}
      
      {/* ADD THIS AT THE END - Update Notification */}
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
```

### Step 3: Test Locally (1 min)

```bash
# Start dev server
npm run dev

# Open browser console (F12)
# Run this:
localStorage.setItem('acknowledged_version', '0.9.0');
// Reload page - you should see update modal!
```

**✅ Feature is working!**

---

## 🚀 Deploy to Production

### Option A: Deploy to Vercel (Recommended)

```bash
# 1. Commit your changes
git add .
git commit -m "Add app update feature"
git push origin main

# Vercel auto-deploys! Done.
```

### Option B: Deploy to Your Server

```bash
# Build
npm run build

# Copy dist folder to your web server
scp -r dist/* user@yourserver:/var/www/pesa-pro/
```

---

## 📱 Add Version Management to Settings

In `src/pages/SettingsPage.tsx`, add this section:

```tsx
import { updateService } from '../services/updateService';

// Add to your SettingsPage component:
<section style={{ marginTop: 30 }}>
  <h3>App Version</h3>
  <p>Current: v{updateService.getCurrentVersion()}</p>
  
  <button onClick={async () => {
    updateService.clearCache();
    await updateService.checkForUpdates();
  }}>
    Check for Updates
  </button>
</section>
```

---

## 👨‍💼 Setup Admin Version Management

Add version management to your admin panel:

```tsx
// In src/pages/AdminPanel.tsx

import { VersionManagementPanel } from '../components/VersionManagementPanel';

// Add to your admin panel tabs:
<Tab label="App Versions">
  <VersionManagementPanel />
</Tab>
```

---

## 📝 Release a New Version

When you want to release v1.0.1:

### Step 1: Update Version Number

Edit `src/services/updateService.ts`:
```tsx
const CURRENT_APP_VERSION = '1.0.1'; // was '1.0.0'
```

### Step 2: Deploy

```bash
npm run build
git add .
git commit -m "v1.0.1: Bug fixes"
git push origin main
# Vercel auto-deploys
```

### Step 3: Add to Database

Visit your admin panel → App Versions → Add New Version

```
Version: 1.0.1
Changelog: 
• Fixed transaction parsing bug
• Improved performance
• Better error handling

Required: No
Download URL: (leave empty for web)
```

### Step 4: Announce to Users

Users will see "Update Available" notification on next login! 🎉

---

## 🔒 Required Security Updates

If you need to force an update (security fix):

```
In admin panel:
Version: 1.0.2 (SECURITY)
Changelog: [Critical] Security patch - please update
Required: YES ← Check this!

Users MUST update to continue using the app.
```

---

## 📊 Monitor Updates

Check if users are updating:

```tsx
// Optional: Add analytics
import { supabase } from './lib/supabase';

// Track update acceptance
const trackUpdate = async (version: string) => {
  await supabase
    .from('analytics')
    .insert([{
      event: 'app_updated',
      version: version,
      user_id: user.id,
      timestamp: new Date(),
    }]);
};
```

---

## 🚨 Troubleshooting

### Update modal not showing?
```tsx
// In browser console:
localStorage.setItem('acknowledged_version', '0.9.0');
location.reload();
// Should show modal now
```

### Can't see database table?
```sql
-- In Supabase SQL Editor:
SELECT * FROM app_versions;
-- Should show 1 row with v1.0.0
```

### Update check failing?
```tsx
// In browser console:
import { updateService } from './services/updateService';
await updateService.checkForUpdates();
// Check browser console for errors
```

---

## 📚 Full Documentation

- **Implementation Guide:** [`UPDATE-FEATURE-GUIDE.md`](UPDATE-FEATURE-GUIDE.md)
- **Hosting & Deployment:** [`HOSTING-RECOMMENDATIONS.md`](HOSTING-RECOMMENDATIONS.md)
- **Integration Examples:** [`INTEGRATION-EXAMPLE.md`](INTEGRATION-EXAMPLE.md)

---

## 🎯 Hosting Decision

**Recommended:**

| Component | Host | Cost/mo |
|-----------|------|---------|
| Web App | **Vercel** | Free (Pro: $20) |
| Backend | **Supabase** (keeping) | Free (Pro: $25) |
| Mobile | **Google Play Store** | Free (one-time $25 dev fee) |
| **Total** | | **$0-45/mo** |

**Setup Time:** 15 minutes (Vercel setup)

---

## ✨ What You Get

After setup, you have:

✅ **Automatic Update Checking** - Runs on app launch  
✅ **User Notifications** - Beautiful modal with changelog  
✅ **Admin Panel** - Manage versions in UI  
✅ **Required Updates** - Force critical security patches  
✅ **Version History** - Users can see all versions  
✅ **Defer Updates** - Users can postpone for 24h  
✅ **Offline Support** - Works without internet  
✅ **Mobile Ready** - Works with Capacitor  

---

## 🎓 Next Steps

1. **Today:** Run migration, add to App.tsx, test locally ✅
2. **Tomorrow:** Deploy to production, add admin panel
3. **This Week:** Setup monitoring, plan first update release
4. **Next Month:** Release v1.0.1 with new features

---

## 💡 Pro Tips

**Tip 1:** Always test locally first
```bash
npm run build
npm run preview
```

**Tip 2:** Use semantic versioning
- 1.0.0 → 1.0.1 (bug fix)
- 1.0.0 → 1.1.0 (new feature)
- 1.0.0 → 2.0.0 (breaking change)

**Tip 3:** Write clear changelogs
```
Good:
• Fixed crash when parsing SMS
• Added dark mode toggle
• Improved offline sync speed

Bad:
• Bug fixes
• Updates
• Stuff
```

**Tip 4:** Test required updates in staging first!

**Tip 5:** Monitor user adoption
- Track how many users update
- Monitor errors in new versions
- Be ready to rollback if issues

---

## 🆘 Need Help?

- **Database Questions:** Check Supabase docs
- **Vercel Issues:** Check Vercel dashboard
- **React Issues:** Check component code comments
- **Architecture:** Read `UPDATE-FEATURE-GUIDE.md`

---

## 📋 Checklist

- [ ] Run migration in Supabase
- [ ] Add imports to App.tsx
- [ ] Add useUpdateChecker hook
- [ ] Add UpdateNotification component
- [ ] Test locally (localStorage trick)
- [ ] Deploy to production
- [ ] Add version in database
- [ ] Test on production
- [ ] Add admin panel (optional)
- [ ] Document version policy
- [ ] Monitor first week
- [ ] Plan v1.0.1 release

---

**Status:** ✨ Ready to deploy!

**Estimated Time:** 30 minutes total  
**Difficulty:** Easy ⭐⭐  
**Support:** Excellent 🎯

Good luck! 🚀
