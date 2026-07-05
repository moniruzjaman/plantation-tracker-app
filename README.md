# 🌳 Plantation Tracker App

**বৃক্ষরোপণ কর্মসূচি — কুড়িগ্রাম কৃষি সম্প্রসারণ অধিদপ্তর**

A professional data collection and reporting application for the "৫ বছরে ২৫ কোটি বৃক্ষরোপণ" campaign.

## 🌐 Live Demo
https://kurigram-plantation-tracker.surge.sh

## 🏗️ Architecture

| Layer | Technology |
|-------|-----------|
| **Frontend** | Vanilla HTML5 + CSS3 + JavaScript |
| **Local Storage** | IndexedDB (offline-first) |
| **Cloud Sync** | Turso DB (SQLite Edge, Tokyo region) |
| **Maps** | Leaflet.js + OpenStreetMap |
| **Charts** | Chart.js |
| **Export** | XLSX + jsPDF |

## 🚀 Features

- 📊 Dashboard with stats, bar chart, doughnut chart
- 📝 Data entry form (all 17 fields from government format)
- 🗺️ Interactive map with GPS auto-capture
- 📋 Records table with search, filter, edit, delete
- 📈 Summary reports by district/upazila/species
- 📤 Export to Excel & PDF
- 💾 Offline-first with auto cloud sync
- 🇧🇩 Full Bengali UI with government branding

## 📦 Files

| File | Size | Description |
|------|------|-------------|
| `index.html` | ~325 KB | Complete single-page app |
| `logo.png` | ~63 KB | DAE Kurigram official logo |

## 🔗 Turso DB Integration

- **URL**: `libsql://plantation-tracker-mithun.aws-ap-northeast-1.turso.io`
- **Region**: Tokyo (closest edge to Bangladesh)
- **Auto-sync**: Every 5 minutes + manual trigger
- **Schema**: Auto-created on first connection

## 🛠️ Setup

1. Open `index.html` in any modern browser
2. Go to **Settings** tab
3. Turso credentials are pre-configured
4. Click **"এখন সিঙ্ক করুন"** to test connection
5. Start entering plantation data!

## 📱 National Scalability

- All **9 divisions** of Bangladesh
- All **64 districts** with cascading dropdowns
- **500+ upazilas** extensible mapping
- Multi-region Turso replicas for fast reads

## 👨‍💻 Developed For

**কৃষি সম্প্রসারণ অধিদপ্তর, খামারবাড়ি, কুড়িগ্রাম**
গণপ্রজাতন্ত্রী বাংলাদেশ সরকার

---
*Built with ❤️ for the 25 Crore Tree Plantation Campaign*
