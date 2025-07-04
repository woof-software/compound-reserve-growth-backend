export type TGoogleSheetsConfig = {
  apiKey: string;
  spreadsheetId: string;
  range: string;
};

export default (): { google: TGoogleSheetsConfig } => ({
  google: {
    apiKey: process.env.GOOGLE_SHEETS_KEY,
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: process.env.GOOGLE_SHEET_RANGE || 'Sheet1!A2:Z',
  },
});
