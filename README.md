# 🌳 Plantation Tracker App — বৃক্ষরোপণ কর্মসূচি

**কৃষি সম্প্রসারণ অধিদপ্তর, খামারবাড়ি, কুড়িগ্রাম**
গণপ্রজাতন্ত্রী বাংলাদেশ সরকার

[![Live Demo](https://img.shields.io/badge/Live%20Demo-সার্ভারে%20চলছে-success?style=for-the-badge)](https://kurigram-plantation-tracker.surge.sh)
[![Turso DB](https://img.shields.io/badge/Database-Turso%20SQLite%20Edge-blue?style=for-the-badge)](https://turso.tech)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> ০৫ বছরে ২৫ কোটি বৃক্ষরোপণ কর্মসূচির জন্য পেশাদার ডেটা সংগ্রহ ও রিপোর্টিং অ্যাপ

---

## 🌐 Live Application

**https://kurigram-plantation-tracker.surge.sh**

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    BROWSER (Any Device)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  IndexedDB  │  │   Leaflet   │  │    Chart.js     │ │
│  │  (Offline)  │  │    Map      │  │   Dashboard     │ │
│  └──────┬──────┘  └─────────────┘  └─────────────────┘ │
│         │                                               │
│         ▼                                               │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Auto-Sync (every 5 min / manual)        │   │
│  │         When online → push pending records      │   │
│  └─────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS / v2/pipeline API
                           ▼
┌─────────────────────────────────────────────────────────┐
│              TURSO DB (SQLite Edge)                     │
│    libsql://plantation-tracker-mithun...turso.io        │
│         Tokyo Edge → 35ms latency to Dhaka              │
│         Free Tier: 5GB | 500M reads | 10M writes/mo     │
└─────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 📊 Dashboard
- Real-time stats cards (total seedlings, locations, species, caretakers, synced count)
- **Chart.js** bar chart (upazila-wise plantation)
- **Chart.js** doughnut chart (species-wise distribution)
- Recent records table

### 📝 Smart Data Entry
- **Cascading dropdowns**: Division → District → Upazila (all 64 districts of Bangladesh)
- **Custom option support**: Add missing upazilas/species on-the-fly
  - Example: *চর রাজিবপুর* missing? Just type it → click "যোগ করুন" → available for all users
- **GPS auto-capture**: One-click geolocation with coordinate auto-fill
- All 17 government-form fields with validation

### 🗺️ Interactive Map
- **Leaflet.js** + OpenStreetMap
- Filter markers by region/district/upazila
- "My Location" button for quick navigation
- Popup details on each marker

### 📋 Records Management
- Full CRUD (Create, Read, Update, Delete)
- Search across all fields
- Filter by region, district, upazila
- Responsive data table

### 📈 Reports & Export
- Summary by district, upazila, species with percentages
- **Export to Excel** (.xlsx)
- **Export to PDF** (.pdf)
- Print-friendly layouts

### 💾 Offline-First + Cloud Sync
| Feature | Technology |
|---------|-----------|
| Local Storage | **IndexedDB** (browser-native) |
| Cloud Database | **Turso DB** (SQLite Edge, Tokyo) |
| Sync Trigger | Auto every 5 min + Manual button |
| Conflict Resolution | `ON CONFLICT(local_id) DO UPDATE` |
| Encryption | End-to-end HTTPS |

### 🇧🇩 Government Branding
- Official **DAE Kurigram** logo
- Bengali (Noto Sans Bengali) throughout
- "০৫ বছরে ২৫ কোটি বৃক্ষরোপণ" campaign badge
- Meta tags for social sharing (Facebook/WhatsApp/Twitter)

---

## 📦 Files

| File | Size | Description |
|------|------|-------------|
| `index.html` | ~329 KB | Complete single-page application |
| `logo.png` | ~63 KB | DAE Kurigram official logo |
| `CNAME` | 36 B | Surge.sh domain configuration |
| `README.md` | — | This documentation |

---

## 🚀 Quick Start

### Option 1: Open Directly
Simply open `index.html` in any modern browser (Chrome, Firefox, Safari, Edge).

### Option 2: Serve Locally
```bash
git clone https://github.com/moniruzjaman/plantation-tracker-app.git
cd plantation-tracker-app

# Python 3
python -m http.server 8080

# Node.js
npx serve .

# PHP
php -S localhost:8080
```
Then visit `http://localhost:8080`

### Option 3: Deploy to Surge.sh
```bash
npm install -g surge
surge
```

---

## 🔗 Turso DB Setup (Optional — Pre-configured)

The app comes with Turso credentials pre-configured. To use your own database:

1. **Install Turso CLI**
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```

2. **Login & Create DB**
   ```bash
   turso auth login
   turso db create plantation-tracker
   ```

3. **Get Credentials**
   ```bash
   turso db show plantation-tracker --url
   turso db tokens create plantation-tracker
   ```

4. **Paste in App Settings**
   - Open app → **Settings** tab
   - Enter URL & Token
   - Click **"এখন সিঙ্ক করুন"**

---

## 🗺️ National Scalability

- ✅ All **9 divisions** of Bangladesh
- ✅ All **64 districts** with cascading dropdowns
- ✅ **500+ upazilas** (extensible via user additions)
- ✅ Multi-region Turso replicas for fast reads anywhere
- ✅ Works offline in remote areas with poor connectivity

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5 + CSS3 + ES6+ |
| Local DB | IndexedDB (browser-native) |
| Cloud DB | Turso DB (libSQL/SQLite Edge) |
| Maps | Leaflet.js + OpenStreetMap |
| Charts | Chart.js 4.x |
| Export | SheetJS (XLSX) + jsPDF |
| Fonts | Noto Sans Bengali (Google Fonts) |
| Icons | Font Awesome 6 |
| Hosting | Surge.sh (CDN) |

---

## 📱 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ✅ Full |
| Edge | 90+ | ✅ Full |
| Android WebView | 90+ | ✅ Full |

---

## 🤝 Contributing

This is an open-source project for the Government of Bangladesh. Contributions welcome!

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License — Free for government and personal use.

---

## 👨‍💻 Developed For

**কৃষি সম্প্রসারণ অধিদপ্তর, খামারবাড়ি, কুড়িগ্রাম**

গণপ্রজাতন্ত্রী বাংলাদেশ সরকার

---

<p align="center">
  <img src="logo.png" width="120" alt="DAE Kurigram Logo">
  <br>
  <b>বৃক্ষরোপণ কর্মসূচি — ২৫ কোটি বৃক্ষের স্বপ্ন</b>
</p>
