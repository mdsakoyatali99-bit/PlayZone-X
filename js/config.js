export const firebaseConfig = {
  apiKey: "AIzaSyCdcK8dOA53JlXvlWcXBNjvBDN1b3rpONc",
  authDomain: "game-portal-9e337.firebaseapp.com",
  databaseURL: "https://game-portal-9e337-default-rtdb.firebaseio.com",
  projectId: "game-portal-9e337",
  storageBucket: "game-portal-9e337.firebasestorage.app",
  messagingSenderId: "559286730353",
  appId: "1:559286730353:web:10e191b8252a45fd53a5d0",
  measurementId: "G-2687TM1GB4"
};
// অ্যাডমিন জিমেইল (firestore.rules ও database.rules.json-এও একই মেইল আছে)
// পাসওয়ার্ড কোডে রাখা হয়নি — সেটি Firebase Authentication যাচাই করে।
export const ADMIN_EMAIL = "mdsakoyatali99@gmail.com";
export const IMGBB_API_KEY = "12349c0f3da793642d34999fb1905304";
export const MAX_SCORE = 1000000;
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const safeUrl = u => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
