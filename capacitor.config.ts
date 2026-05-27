import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId:   'com.pesapro.app',
  appName: 'Pesa Pro',
  webDir:  'dist',

  android: {
    // Required for pdf.js crypto APIs on older Android WebViews
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,   // set true only during dev
  },

  server: {
    // androidScheme 'https' required for Supabase auth cookies to work on Android
    androidScheme: 'https',
    // allowNavigation: add external domains if using Daraja API later
    allowNavigation: [],
  },

  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor:  '#00A651',
    },
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor:    '#111411',
      showSpinner: false,
    },
  },
}

export default config
