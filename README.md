# Google Sheets API

This API fetches data from Google Sheets and exposes it via REST endpoints.

## 🚀 Endpoints

### Get all data
GET /api/sheet

### Get user by mobile
GET /api/user?mobile=9876543210

---

## ⚙️ Environment Variables

Set these in Render:

- GOOGLE_CREDENTIALS → Full JSON of service account
- SHEET_ID → Your Google Sheet ID

---

## 🛠 Run locally

npm install  
node index.js