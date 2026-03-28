const { fetchSheetRows, getAccessToken } = require('./_lib/google-sheets');
const { mapSheetRows } = require('./_lib/bookings');

exports.handler = async () => {
  try {
    const accessToken = await getAccessToken({ readOnly: true });
    const rows = await fetchSheetRows(accessToken);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: mapSheetRows(rows) })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message || 'Unable to load availability.' })
    };
  }
};
