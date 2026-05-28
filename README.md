# Pesa Pro - Intelligent M-Pesa Financial Management

**⚡ Powered by [FetroTech](https://fetrotech.com)**

Pesa Pro is a high-performance financial intelligence platform specifically engineered for the Kenyan M-Pesa ecosystem. It transforms raw SMS data into actionable financial insights, making it the ultimate tool for individuals, small business owners (Dukas), and fundraising committees (Chamas).

## 🚀 The Core Moat: Native M-Pesa Intelligence

Unlike generic trackers, Pesa Pro features a **"God-Tier" Regex Engine** designed to handle the complexities of Safaricom's messaging patterns, including debt (FULIZA), business payouts (Pochi la Biashara), and reversals.

### 🌟 Key Features

- 🤖 **AI-Driven Categorization**: Automatically detects and tags transactions into categories like *Utilities, Food, Business, Transport,* and *Debt*.
- 🚨 **Financial Health Shield**: Active monitoring for "Dark Patterns." The system flags gambling activity (SportPesa, Aviator) and high-interest debt loops.
- 🤝 **Premium Campaign Hub**: Start and manage professional fundraising goals (Medical, Harambee, Funeral) with:
  - **HD Poster Generator**: Create branded social media posters instantly.
  - **QR Code Payments**: One-tap payment links for donors.
  - **Real-time Contribution Sync**: Watch progress move live as members donate.
- 📄 **Institutional Reporting**:
  - **Bank-Grade PDF Statements**: Generate formal financial statements with FetroTech branding and summary analytics.
  - **Branded Digital Receipts**: One-click professional receipts for incoming payments, ready for WhatsApp sharing.
- 📱 **Mobile-First Experience**: 
  - **APK Auto-Sync**: Exclusive to the Android version—automatically reads M-Pesa SMS from the inbox.
  - **AMOLED Dark Mode**: True #000000 black theme for battery efficiency on budget devices.
  - **Bilingual Interface**: Seamlessly switch between **English** and **Swahili** (Mapato, Matumizi, Salio).

## 🛠️ Technical Architecture

| Layer | Technology |
| :--- | :--- |
| **Frontend** | **React 19** + **Vite** + **TypeScript** |
| **Styling** | **Tailwind CSS** (Custom Glassmorphism Design) |
| **Backend** | **Supabase** (PostgreSQL, Real-time, RLS) |
| **Mobile Bridge** | **Capacitor 6** |
| **Analytics** | **Recharts** (SVG high-performance charts) |
| **Documentation** | **jsPDF** & **html2canvas** |
| **Icons/Type** | **Lucide React** + **Sora Font Family** |

## 📸 Screen Tour

1.  **Dashboard (Command Center)**: A unified hub showing Cash Inflow vs. Outflow, AI Category insights, and active Health Alerts.
2.  **History (History Hub)**: A dense, searchable ledger of all transactions with PDF Export and Receipt generation.
3.  **Campaigns (Harambee Hub)**: A grid of interactive goal cards with real-time progress bars.
4.  **Security (The Fortress)**: Native-grade Two-Factor Authentication (MFA) setup using TOTP and Google Authenticator.
5.  **Import (AI Engine)**: The gateway for pasting M-Pesa SMS or triggering the APK Auto-Sync.

## 🔒 Security & Privacy

- **Row Level Security (RLS)**: Your financial data is isolated at the database level. User A can never see User B's data.
- **Privacy Mode**: One-tap "Matatu-Proof" mode that blurs balances in public spaces.
- **Onboarding Flow**: A transparent 3-layer permission flow ensures users understand and consent to SMS access.

## 🏁 Getting Started

### For Web Development
```bash
npm install
npm run dev
```

### For Android APK Build
1. Build the web assets: `npm run build`
2. Sync with native: `npx cap sync android`
3. Open in Android Studio: `npx cap open android`
4. Build: **Build > Build APK(s)**

---
Built with ❤️ by the **FetroTech** team to empower financial clarity across Kenya.
🔗 [fetrotech.com](https://fetrotech.com)
