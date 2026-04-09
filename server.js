const express = require('express');
const { google } = require('googleapis');

const app = express();

console.log("🚀 Starting EMI API server...");

// 🔐 ENV validation
if (!process.env.GOOGLE_CREDENTIALS || !process.env.SHEET_ID) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

// 🔐 Optional API Key
const API_KEY = process.env.API_KEY;

// Middleware (optional security)
app.use((req, res, next) => {
  if (!API_KEY) return next();
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
});

// Google Auth
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// 🧠 Normalize phone numbers
function normalizePhone(num) {
  if (!num) return "";
  return String(num).replace(/\D/g, '').slice(-10);
}

// 🔁 Cache (30 sec)
let cache = {
  data: null,
  timestamp: 0
};

async function getSheetData() {
  const now = Date.now();

  // Return cached data if fresh
  if (cache.data && (now - cache.timestamp < 30000)) {
    console.log("⚡ Using cached data");
    return cache.data;
  }

  console.log("📊 Fetching fresh data from Google Sheets");

  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Sheet1!A:U',
  });

  const rows = response.data.values || [];

  // Update cache
  cache = {
    data: rows,
    timestamp: now
  };

  return rows;
}

// 🧠 Row Mapper
function mapRow(row) {
  return {
    username: row[0] || "",
    mobile: row[1] || "",
    loan_amount: Number(row[2] || 0),
    interest: row[3] || "",
    loan_date: row[4] || "",
    pending_amount: Number(row[5] || 0),

    emi: {
      pending: Number(row[6] || 0),
      amount: Number(row[7] || 0),
      paid: Number(row[8] || 0),
    },

    last_payments: [
      { date: row[9] || "", amount: Number(row[10] || 0) },
      { date: row[11] || "", amount: Number(row[12] || 0) },
      { date: row[13] || "", amount: Number(row[14] || 0) }
    ],

    delays: {
      count: Number(row[15] || 0),
      max: Number(row[16] || 0),
      min: Number(row[17] || 0)
    },

    next_emi_due_date: row[18] || "",
    days_overdue: Number(row[19] || 0),
    collection_status: row[20] || ""
  };
}

// 🔹 GET USER BY MOBILE (PRIMARY USE CASE)
app.get('/api/user', async (req, res) => {
  try {
    const mobile = req.query.mobile;

    if (!mobile) {
      return res.status(400).json({ error: "mobile query param required" });
    }

    const cleanMobile = normalizePhone(mobile);

    console.log(`🔍 Searching for: ${cleanMobile}`);

    const rows = await getSheetData();

    if (rows.length <= 1) {
      return res.status(404).json({ message: "No data in sheet" });
    }

    const userRow = rows.slice(1).find(row =>
      normalizePhone(row[1]) === cleanMobile
    );

    if (!userRow) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json(mapRow(userRow));

  } catch (error) {
    console.error("❌ Error fetching user:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 🔹 GET ALL USERS (basic)
app.get('/api/users', async (req, res) => {
  try {
    const rows = await getSheetData();

    const data = rows.slice(1).map(mapRow);

    return res.json({
      total: data.length,
      data
    });

  } catch (error) {
    console.error("❌ Error fetching users:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// 🔹 Health Check
app.get('/', (req, res) => {
  res.send("EMI API running 🚀");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});