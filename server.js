const express = require('express');
const { google } = require('googleapis');

const app = express();

console.log("🚀 Starting server...");

// 🔐 Validate ENV variables early
if (!process.env.GOOGLE_CREDENTIALS || !process.env.SHEET_ID) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

// Google Auth using ENV variable
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

// 🔹 Helper function to fetch sheet data (DRY code)
async function getSheetData() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range: 'Sheet1!A:U',
  });

  return response.data.values || [];
}

// 🔹 GET ALL DATA
app.get('/api/sheet', async (req, res) => {
  try {
    console.log("📊 Fetching full sheet data...");

    const rows = await getSheetData();

    if (rows.length === 0) {
      return res.json([]);
    }

    const data = rows.slice(1).map(row => ({
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
    }));

    res.json(data);

  } catch (error) {
    console.error("❌ Error fetching sheet:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 GET USER BY MOBILE
app.get('/api/user', async (req, res) => {
  try {
    const mobile = req.query.mobile;

    if (!mobile) {
      return res.status(400).json({ error: "mobile query param required" });
    }

    console.log(`🔍 Fetching user for mobile: ${mobile}`);

    const rows = await getSheetData();

    const user = rows.slice(1).find(row => row[1] === mobile);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      username: user[0] || "",
      mobile: user[1] || "",
      pending_amount: Number(user[5] || 0),
      next_emi_due_date: user[18] || "",
      collection_status: user[20] || ""
    });

  } catch (error) {
    console.error("❌ Error fetching user:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Root check
app.get('/', (req, res) => {
  res.send("API is running 🚀");
});

// 🔹 Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));