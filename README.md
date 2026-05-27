# Pesa Pro 🚀
### Automated M-PESA Bookkeeping & Chama Management

**Pesa Pro** is an Android-first financial companion designed specifically for the Kenyan ecosystem. It replaces traditional paper notebooks and manual spreadsheets by transforming M-PESA SMS confirmations into actionable financial insights in real-time.

[![Platform](https://img.shields.io/badge/Platform-Android-green.svg)](#)
[![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Capacitor%20%7C%20Supabase-blue.svg)](#)
[![Privacy](https://img.shields.io/badge/Privacy-Offline--First-orange.svg)](#)

---

## ✨ Core Pillars

### 1. Smart SMS Automation
*   **Zero-Tap Import**: Native background listeners parse M-PESA SMS the moment they arrive.
*   **Intelligent Parsing**: Extracts amount, transaction code, merchant/sender name, balance, and transaction fees.
*   **Confidence Scoring**: Uses pattern matching and historical data to auto-verify transactions with up to 100% accuracy.

### 2. Chama & Group Bookkeeping
*   **Member Sync**: Match incoming payments to group members automatically by phone number.
*   **Transaction Splitting**: One M-PESA payment can be split into multiple allocations (e.g., KES 500 = 400 Contribution + 100 Penalty).
*   **Meeting Mode**: A live, shared ledger view for treasurers to project or share during physical meetings.

### 3. Smart Budget Engine
*   **Predictive Analytics**: "At this pace, you'll overspend by KES X" — real-time velocity calculations.
*   **Threshold Alerts**: Native Android notifications fire at 80% and 100% budget usage.
*   **Budget Rollover**: Optional unspent balance carry-over for healthcare or emergency savings.

### 4. Privacy & Transparency
*   **Local-Only Mode**: Use the app fully without an account. Data stays on your device.
*   **Edge Parsing**: SMS parsing happens entirely on-device. Raw message text never hits the cloud.
*   **One-Tap Wipe**: Permanent data deletion across local storage and remote cloud in a single click.

---

## 🛠 Tech Stack

*   **Frontend**: React 19 + Vite (Fast, modular UI)
*   **Mobile Bridge**: Capacitor 8 (Native Android integration)
*   **Database**: Supabase (PostgreSQL with Row Level Security)
*   **State Management**: TanStack Query v5 (with offline persistence)
*   **Icons & UI**: Lucide React + Framer Motion (Fluid Safaricom-inspired UX)
*   **Notifications**: Capacitor Local Notifications

---

## 🚀 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Android Studio (for native builds)
*   Supabase Account

### Setup
1.  **Clone & Install**:
    ```bash
    git clone https://github.com/yourusername/pesa-pro.git
    cd pesa-pro
    npm install
    ```

2.  **Database Migration**:
    Run the SQL scripts in `supabase/migrations/` in your Supabase SQL Editor to set up the `transactions`, `groups`, `budgets`, and `debts` tables.

3.  **Run Development**:
    ```bash
    npm run dev
    ```

4.  **Build for Android**:
    ```bash
    npm run build
    npx cap sync android
    cd android
    ./gradlew installDebug
    ```

---

## 🗺 Roadmap

- [ ] **M-PESA Statement PDF Parser**: Batch import months of history in seconds.
- [ ] **AI Spending Coach**: Personalized weekly insights powered by Claude API.
- [ ] **Merchant Intelligence**: Crowdsourced database to turn "TILL 654321" into "Naivas Supermarket."
- [ ] **Offline OCR Receipt Scanner**: Capture cash transactions via camera.

---

## 📄 License
This project is proprietary. For inquiries or collaboration, contact the development lead at `fetrogames1@gmail.com`.

---
*Built with ❤️ for the Kenyan Financial Ecosystem.*
