// Central configuration. Change API_BASE_URL to your deployed JSON Server URL
// (for example https://your-api.onrender.com) before deploying the frontend.
export const API_BASE_URL = 'http://localhost:3000';

// Public catalogue API used for importing products .
export const CATALOGUE_BASE_URL = 'https://dummyjson.com';

// DummyJSON prices are in US dollars. Prices in AssetTrack are in Kenya Shillings (KES).
// Check the current rate before you present the project.
export const USD_TO_KES = 129;


// How many items are shown per page on the Items page.
export const PAGE_SIZE = 8;