const { JWT } = require('google-auth-library');

const getAccessToken = async ({ readOnly = false } = {}) => {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error('Google Sheets credentials are missing.');
  }

  const client = new JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      readOnly
        ? 'https://www.googleapis.com/auth/spreadsheets.readonly'
        : 'https://www.googleapis.com/auth/spreadsheets'
    ]
  });

  const { access_token: accessToken } = await client.authorize();
  return accessToken;
};

const getSheetConfig = () => {
  const sheetId = process.env.SHEET_ID;
  const sheetTab = process.env.SHEET_TAB || 'Bookings';

  if (!sheetId) {
    throw new Error('SHEET_ID is missing.');
  }

  return { sheetId, sheetTab };
};

const fetchSheetRows = async (accessToken) => {
  const { sheetId, sheetTab } = getSheetConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTab)}!A1:Z1000`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!response.ok) {
    throw new Error('Unable to read from Google Sheets.');
  }

  const data = await response.json();
  return data.values || [];
};

const appendSheetRow = async (accessToken, row) => {
  const { sheetId, sheetTab } = getSheetConfig();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheetTab)}!A1:append?valueInputOption=RAW`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values: [row] })
  });

  if (!response.ok) {
    throw new Error('Unable to append booking to Google Sheets.');
  }
};

module.exports = {
  appendSheetRow,
  fetchSheetRows,
  getAccessToken
};
