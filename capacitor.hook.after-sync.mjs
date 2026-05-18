// capacitor.hook.after-sync.mjs
// Automatically patches android:exported after every `npx cap sync android`
// Capacitor runs files matching capacitor.hook.*.mjs automatically.

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const manifestPath = resolve(
  'android',
  'capacitor-cordova-android-plugins',
  'src', 'main', 'AndroidManifest.xml'
);

let xml;
try {
  xml = readFileSync(manifestPath, 'utf8');
} catch {
  console.log('[hook] AndroidManifest.xml not found — skipping patch.');
  process.exit(0);
}

const receivers = [
  'com.tonikorin.cordova.plugin.autostart.BootCompletedReceiver',
  'com.tonikorin.cordova.plugin.autostart.UserPresentReceiver',
  'com.tonikorin.cordova.plugin.autostart.PackageReplacedReceiver',
];

let patched = 0;
for (const r of receivers) {
  const escaped = r.replace(/\./g, '\\.');
  const pattern = new RegExp(
    `(<receiver[^>]+android:name="${escaped}"[^>]*?)(?!\\s+android:exported)(>|/>)`,
    'g'
  );
  const next = xml.replace(pattern, '$1 android:exported="true"$2');
  if (next !== xml) { xml = next; patched++; }
}

if (patched > 0) {
  writeFileSync(manifestPath, xml, 'utf8');
  console.log(`[hook] Patched ${patched} receiver(s) with android:exported="true"`);
} else {
  console.log('[hook] android:exported already set — no changes needed.');
}
