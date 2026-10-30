import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, writeBatch, serverTimestamp, onSnapshot, deleteDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig, ADMIN_EMAIL, IMGBB_API_KEY, safeUrl } from "./config.js";

const app = initializeApp(firebaseConfig), db = getDatabase(app), fs = getFirestore(app), auth = getAuth(app);
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = v => String(v || "").trim().toLowerCase();
const isAdminEmail = em => !!ADMIN_EMAIL && norm(em) === norm(ADMIN_EMAIL);
let busy = false;
let userRows = [];
const html = v => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateValue = v => { if (!v) return null; if (typeof v.toDate === "function") return v.toDate(); const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
const dateLabel = v => { const d = dateValue(v); return d ? d.toLocaleDateString("bn-BD", { day:"2-digit", month:"short", year:"numeric" }) : "—"; };
const points = v => Math.max(0, Math.floor(Number(v) || 0));
let noticeTimer;
function adminNotice(type, title, message) {
  const modal = $("adminNotice"); if (!modal) { alert(message); return; }
  const success = type === "success";
  $("adminNoticeIcon").innerHTML = success ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
  $("adminNoticeIcon").className = `admin-notice-icon ${success ? "is-success" : "is-error"}`;
  $("adminNoticeTitle").textContent = title; $("adminNoticeMessage").textContent = message;
  modal.classList.add("show"); modal.setAttribute("aria-hidden", "false");
  clearTimeout(noticeTimer); noticeTimer = setTimeout(closeAdminNotice, 4200);
}
function closeAdminNotice() { const modal = $("adminNotice"); if (!modal) return; modal.classList.remove("show"); modal.setAttribute("aria-hidden", "true"); clearTimeout(noticeTimer); }
$("adminNoticeClose")?.addEventListener("click", closeAdminNotice);
$("adminNotice")?.querySelector(".admin-notice-backdrop")?.addEventListener("click", closeAdminNotice);

function renderUsers() {
  const box = $("adminUsersList"); if (!box) return;
  const q = norm($("userSearch")?.value || ""), sort = $("userSort")?.value || "score";
  let rows = userRows.filter(u => norm(u.name).includes(q) || norm(u.id).includes(q));
  rows.sort((a,b) => sort === "newest" ? ((dateValue(b.createdAt)?.getTime() || 0) - (dateValue(a.createdAt)?.getTime() || 0)) : sort === "name" ? String(a.name||"").localeCompare(String(b.name||"")) : points(b.totalScore)-points(a.totalScore));
  $("userCountLabel").textContent = `${rows.length.toLocaleString("bn-BD")} / ${userRows.length.toLocaleString("bn-BD")} ইউজার`;
  $("userPaginationInfo").textContent = `দেখানো হচ্ছে ${rows.length.toLocaleString("bn-BD")} জন`;
  if (!rows.length) { box.innerHTML = '<tr><td colspan="6" class="table-empty">কোনো ইউজার পাওয়া যায়নি।</td></tr>'; return; }
  box.innerHTML = rows.map(u => {
    const photo = safeUrl(u.photoURL), avatar = photo ? `<img class="player-avatar" src="${html(photo)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<span class="player-avatar">${html((u.name||"U").trim().slice(0,1).toUpperCase())}</span>`;
    return `<tr><td><div class="player-cell">${avatar}<div><div class="player-name">${html(u.name || "Unnamed Player")}</div><div class="player-sub">${html(u.lastActiveAt ? "সাম্প্রতিক অ্যাক্টিভিটি আছে" : "প্রোফাইল ইউজার")}</div></div></div></td><td><span class="id-chip" title="${html(u.id)}">${html(u.id)}</span></td><td><span class="score-chip">${points(u.totalScore).toLocaleString("bn-BD")} pts</span></td><td>${dateLabel(u.createdAt)}</td><td>${html(u.lastPlayedGame || "—")}</td><td><div class="row-actions"><button class="row-action edit" data-user-edit="${html(u.id)}"><i class="fa-solid fa-pen-to-square"></i> এডিট</button><button class="row-action delete" data-user-delete="${html(u.id)}" title="ইউজার মুছুন"><i class="fa-solid fa-trash"></i></button></div></td></tr>`;
  }).join("");
  box.querySelectorAll("[data-user-edit]").forEach(btn => btn.addEventListener("click", () => openUserEditor(btn.dataset.userEdit)));
  box.querySelectorAll("[data-user-delete]").forEach(btn => btn.addEventListener("click", () => deleteUser(btn.dataset.userDelete)));
}
function openUserEditor(id) {
  const u = userRows.find(x => x.id === id); if (!u) return;
  $("editOriginalId").value = u.id; $("editUserId").value = u.id; $("editUserName").value = u.name || ""; $("editUserScore").value = points(u.totalScore); $("editUserPhoto").value = safeUrl(u.photoURL) || ""; $("editUserStatus").textContent = "";
  $("userEditModal").classList.remove("hidden");
}
async function deleteUser(id) {
  const u = userRows.find(x => x.id === id); if (!u || !confirm(`“${u.name || id}” ইউজারের প্রোফাইল ও লিডারবোর্ড ডেটা স্থায়ীভাবে মুছে ফেলবেন?`)) return;
  try { await deleteDoc(doc(fs, "users", id)); } catch (e) { console.error(e); alert("ইউজার মুছতে ব্যর্থ। Firebase Rules/অ্যাডমিন লগইন যাচাই করুন।"); }
}
function watchUsers() {
  onSnapshot(collection(fs, "users"), snap => {
    userRows = snap.docs.map(d => ({ id:d.id, ...d.data() }));
    const today = new Date(); today.setHours(0,0,0,0);
    const todayCount = userRows.filter(u => { const d = dateValue(u.createdAt); return d && d >= today; }).length;
    $("statTotalUsers").textContent = userRows.length.toLocaleString("bn-BD");
    $("statTodayUsers").textContent = todayCount.toLocaleString("bn-BD");
    $("statTodayDate").textContent = new Date().toLocaleDateString("bn-BD", { day:"numeric", month:"long" });
    $("statTotalScore").textContent = userRows.reduce((sum,u) => sum + points(u.totalScore),0).toLocaleString("bn-BD");
    renderUsers();
  }, err => { console.error(err); $("adminUsersList").innerHTML = '<tr><td colspan="6" class="table-empty">ইউজার ডেটা লোড হয়নি। Firebase Firestore Rules ও অ্যাডমিন লগইন পরীক্ষা করুন।</td></tr>'; });
}
watchUsers();
$("userSearch")?.addEventListener("input", renderUsers);
$("userSort")?.addEventListener("change", renderUsers);
document.querySelectorAll("[data-close-edit]").forEach(el => el.addEventListener("click", () => $("userEditModal").classList.add("hidden")));
$("editUserForm")?.addEventListener("submit", async e => {
  e.preventDefault(); const status = $("editUserStatus"); status.textContent = "সেভ হচ্ছে…";
  const oldId = $("editOriginalId").value, newId = $("editUserId").value.trim(), name = $("editUserName").value.trim(), score = Number($("editUserScore").value), photoRaw = $("editUserPhoto").value.trim(), photoURL = photoRaw ? safeUrl(photoRaw) : "";
  if (name.length < 2 || name.length > 20) { status.textContent = "নাম ২–৪০ অক্ষরের মধ্যে দিন।"; return; }
  if (!newId || newId.length > 128 || /[/.#$\[\]]/.test(newId)) { status.textContent = "আইডিতে Firebase-এর নিষিদ্ধ অক্ষর ব্যবহার করা যাবে না।"; return; }
  if (!Number.isSafeInteger(score) || score < 0 || score > 1000000000) { status.textContent = "সঠিক পয়েন্ট দিন (০–১,০০০,০০০,০০০)।"; return; }
  if (photoRaw && (!photoURL || !photoURL.startsWith("https://"))) { status.textContent = "প্রোফাইল ছবির জন্য বৈধ HTTPS URL দিন।"; return; }
  try {
    const original = userRows.find(u => u.id === oldId); if (!original) throw new Error("user_not_found");
    const data = { ...original, name, totalScore: score, updatedAt: serverTimestamp() };
    if (photoURL) data.photoURL = photoURL; else delete data.photoURL;
    delete data.id;
    if (newId !== oldId) {
      if (userRows.some(u => u.id === newId)) { status.textContent = "এই আইডি আগে থেকেই আছে। অন্য আইডি দিন।"; return; }
      await setDoc(doc(fs, "users", newId), data); await deleteDoc(doc(fs, "users", oldId));
      status.textContent = "আইডি পরিবর্তন হয়েছে। ইউজারকে নতুন আইডি দিয়ে প্রোফাইল পুনরায় তৈরি করতে হতে পারে।";
    } else await setDoc(doc(fs, "users", oldId), data);
    $("userEditModal").classList.add("hidden");
  } catch (err) { console.error(err); status.textContent = "সেভ ব্যর্থ। Firebase Rules/অ্যাডমিন অনুমতি পরীক্ষা করুন।"; }
});

const ADMIN_SECTIONS = {
  adminOverview: "ড্যাশবোর্ড ও স্ট্যাটস", adminUsers: "ইউজার ম্যানেজমেন্ট",
  adminChat: "গ্লোবাল চ্যাট কন্ট্রোল", adminAddGame: "নতুন গেম যুক্ত করুন",
  adminGames: "গেম ম্যানেজমেন্ট", adminBanners: "ব্যানার ম্যানেজমেন্ট",
  adminAddBanner: "নতুন ব্যানার যুক্ত করুন", adminSystem: "সিস্টেম কন্ট্রোল"
};
function setAdminSection(sectionId) {
  if (!ADMIN_SECTIONS[sectionId]) sectionId = "adminOverview";
  Object.keys(ADMIN_SECTIONS).forEach(id => $(id)?.classList.toggle("admin-view-hidden", id !== sectionId));
  const utility = $("adminUtilityGroup");
  if (utility) utility.classList.toggle("admin-view-hidden", !["adminAddBanner", "adminSystem"].includes(sectionId));
  const notice = $("adminSectionNotice");
  if (notice) {
    const icons = {adminOverview:"fa-chart-pie",adminUsers:"fa-users",adminChat:"fa-comments",adminAddGame:"fa-circle-plus",adminGames:"fa-gamepad",adminBanners:"fa-images",adminAddBanner:"fa-image",adminSystem:"fa-sliders"};
    notice.innerHTML = `<i class="fa-solid ${icons[sectionId] || "fa-layer-group"}"></i><span>${ADMIN_SECTIONS[sectionId]}</span><small>PlayZone X Admin Control Center</small>`;
  }
  document.querySelectorAll("[data-admin-section]").forEach(a => a.classList.toggle("active", a.dataset.adminSection === sectionId));
  history.replaceState(null, "", `#${sectionId}`);
}

const show = (ok, msg) => {
  $("adminAuthBox").classList.toggle("hidden", ok);
  $("adminWrap").classList.toggle("hidden", !ok);
  $("adminDashboard").classList.toggle("hidden", !ok);
  const s = $("adminAuthStatus"); s.textContent = msg || ""; s.classList.toggle("hidden", !msg);
  if (msg && !ok) { const c = $("loginCard"); c.classList.remove("shake"); void c.offsetWidth; c.classList.add("shake"); }
};
const step = (id, state) => { $(id).className = state || ""; };
const resetSteps = () => { step("stepCode"); step("stepAuth"); };
const setBusy = b => { busy = b; $("loginBtn").classList.toggle("loading", b); };

// Firebase সেশন থেকে অটো-লগইন / লগআউট হ্যান্ডেল
async function gate(user) {
  if (busy) return;
  if (!user) return show(false);
  if (!isAdminEmail(user.email)) { await signOut(auth); return show(false, "এই অ্যাকাউন্টের অ্যাডমিন অ্যাক্সেস নেই।"); }
  enter(user);
}
function enter(user) {
  show(true);
  setAdminSection("adminOverview");
  startChatAdmin();
  loadOwnerProfile();
}

// Owner is always the Firebase account matching ADMIN_EMAIL. No manual selection.
async function loadOwnerProfile(){
  const user=auth.currentUser;
  const info=$("ownerCurrentInfo");
  if(!user || !isAdminEmail(user.email)){ if(info) info.textContent="Owner তথ্য পাওয়া যায়নি।"; return; }
  try {
    const snap=await getDoc(doc(fs,"users",user.uid));
    if(info) info.textContent=snap.exists() ? `বর্তমান Owner: ${snap.data().name || snap.data().username || user.email} · ${user.email}` : `Owner Gmail: ${user.email} (ইউজার প্রোফাইল এখনো তৈরি হয়নি)`;
  } catch(e){ console.error(e); if(info) info.textContent=`Owner Gmail: ${user.email}`; }
}

// Global chat moderation controls (admin-only)
let chatAdminRows = [], chatAdminUnsub = null, mutedIds = new Set();
function renderAdminChat(){
 const box=$("adminChatMessages"); if(!box)return;
 const term=norm($("chatAdminSearch")?.value||"");
 const rows=chatAdminRows.filter(m=>norm(m.username+" "+m.uid+" "+m.message).includes(term));
 $("chatAdminCount").textContent=`${rows.length} / ${chatAdminRows.length} মেসেজ`;
 box.innerHTML=rows.map(m=>`<article class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-800/70 p-3"><div class="min-w-0 flex-1"><div class="text-sm font-bold text-slate-100">${html(m.username||m.name||"Player")} <span class="text-xs text-slate-500">${html(m.uid||"")}</span></div><p class="text-sm text-slate-300 break-words">${html(m.message||"")}</p></div><div class="flex flex-wrap gap-2"><button class="row-action delete" data-chat-delete="${html(m.id)}">মুছুন</button>${m.uid&&m.uid!=="system"?`<button class="row-action" data-chat-mute="${html(m.uid)}">${mutedIds.has(m.uid)?"আনমিউট":"মিউট"}</button>`:""}</div></article>`).join("")||'<p class="admin-muted">কোনো মেসেজ পাওয়া যায়নি।</p>';
 box.querySelectorAll('[data-chat-delete]').forEach(b=>b.onclick=async()=>{if(confirm("এই মেসেজটি মুছবেন?"))try{await deleteDoc(doc(fs,"globalChat",b.dataset.chatDelete));}catch(e){alert("মেসেজ মুছতে ব্যর্থ। Rules পরীক্ষা করুন।");}});
 box.querySelectorAll('[data-chat-mute]').forEach(b=>b.onclick=async()=>{const uid=b.dataset.chatMute;const old=mutedIds.has(uid);try{await setDoc(doc(fs,"chatModeration",uid),{muted:!old,updatedAt:serverTimestamp()},{merge:true});}catch(e){alert("মিউট পরিবর্তন করা যায়নি। Rules পরীক্ষা করুন।");}});
}
function startChatAdmin(){
 onSnapshot(collection(fs,"chatModeration"),snap=>{mutedIds=new Set(snap.docs.filter(d=>d.data().muted===true).map(d=>d.id));renderAdminChat();});
 if(chatAdminUnsub)chatAdminUnsub();
 chatAdminUnsub=onSnapshot(query(collection(fs,"globalChat"),orderBy("createdAt","desc"),limit(150)),snap=>{chatAdminRows=snap.docs.map(d=>({id:d.id,...d.data()}));renderAdminChat();},e=>{$("adminChatMessages").innerHTML='<p class="text-rose-300">চ্যাট ডেটা লোড হয়নি। Firestore Rules প্রকাশ করুন।</p>';console.error(e);});
 onSnapshot(doc(fs,"chatSettings","global"),snap=>{const d=snap.data()||{};$("chatAdminStatus").textContent=d.enabled===false?"CHAT DISABLED":"CHAT ENABLED";});
 $("chatEnableBtn").onclick=()=>setDoc(doc(fs,"chatSettings","global"),{enabled:true,updatedAt:serverTimestamp()},{merge:true});
 $("chatDisableBtn").onclick=()=>setDoc(doc(fs,"chatSettings","global"),{enabled:false,updatedAt:serverTimestamp()},{merge:true});
 $("chatBotOnBtn").onclick=()=>setDoc(doc(fs,"chatSettings","global"),{botEnabled:true,updatedAt:serverTimestamp()},{merge:true});
 $("chatBotOffBtn").onclick=()=>setDoc(doc(fs,"chatSettings","global"),{botEnabled:false,updatedAt:serverTimestamp()},{merge:true});
 $("chatClearBtn").onclick=async()=>{if(!confirm("সর্বশেষ লোড হওয়া সর্বোচ্চ ১৫০টি চ্যাট মেসেজ মুছে ফেলবেন?"))return;const batch=writeBatch(fs);chatAdminRows.forEach(m=>batch.delete(doc(fs,"globalChat",m.id)));try{await batch.commit();}catch(e){alert("চ্যাট ক্লিয়ার করা যায়নি।");}};
 $("chatAdminSearch")?.addEventListener("input",renderAdminChat);
}
startChatAdmin();

onAuthStateChanged(auth, gate);

async function handleLogin(e) {
  e.preventDefault();
  if (busy) return;
  const email = $("adminEmail").value.trim(), pass = $("adminPass").value;
  show(false); resetSteps();
  if (!email || !pass) return show(false, "ইমেইল ও পাসওয়ার্ড দুটিই দিন।");
  setBusy(true);
  try {
    // ধাপ ১: অ্যাপ কোডে থাকা অ্যাডমিন ইমেইলের সাথে মিলানো
    step("stepCode", "run"); await sleep(450);
    if (!isAdminEmail(email)) { step("stepCode", "bad"); throw { custom: "এই ইমেইলের অ্যাডমিন অ্যাক্সেস নেই।" }; }
    step("stepCode", "ok");
    // ধাপ ২: Firebase Authentication-এ ইমেইল + পাসওয়ার্ড যাচাই
    step("stepAuth", "run");
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    if (!isAdminEmail(cred.user.email)) { await signOut(auth); step("stepAuth", "bad"); throw { custom: "এই অ্যাকাউন্টের অ্যাডমিন অ্যাক্সেস নেই।" }; }
    step("stepAuth", "ok"); await sleep(600);
    $("adminPass").value = "";
    enter(cred.user);
  } catch (err) {
    if (!err.custom) step("stepAuth", "bad");
    show(false, err.custom || authMsg(err));
  } finally { setBusy(false); }
}
function authMsg(err) {
  switch (err && err.code) {
    case "auth/invalid-credential": case "auth/wrong-password": case "auth/user-not-found": case "auth/invalid-login-credentials":
      return "ইমেইল বা পাসওয়ার্ড ভুল। Firebase Authentication-এ এই ইউজার আছে কি না দেখুন।";
    case "auth/operation-not-allowed": return "Firebase Authentication-এ Email/Password সাইন-ইন মেথড চালু করা নেই।";
    case "auth/too-many-requests": return "অনেকবার ভুল চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";
    case "auth/network-request-failed": return "ইন্টারনেট সংযোগ চেক করুন।";
    case "auth/invalid-email": return "সঠিক ইমেইল ঠিকানা দিন।";
    default: return "লগইন ব্যর্থ: " + ((err && err.message) || "অজানা সমস্যা");
  }
}
$("loginForm").addEventListener("submit", handleLogin);
$("logoutBtn").addEventListener("click", async () => { await signOut(auth); resetSteps(); show(false); });
// Live CRUD panels for games and banners
const gamesRef = ref(db, "games"), bannersRef = ref(db, "banners");
onValue(gamesRef, snap => {
  const box = $("adminGamesList"); if (!box) return;
  const rows = snap.val() || {}; $("statTotalGames").textContent = Object.keys(rows).length.toLocaleString("bn-BD"); box.innerHTML = "";
  if (!Object.keys(rows).length) { box.innerHTML = '<p class="text-sm text-slate-400">কোনো গেম নেই।</p>'; return; }
  Object.entries(rows).forEach(([id,g]) => {
    const row = document.createElement("div"); row.className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl bg-slate-800/70 border border-slate-700";
    row.innerHTML = `<img src="${safeUrl(g.img)||""}" class="w-20 h-14 object-cover rounded-lg bg-slate-950"><div class="flex-1 min-w-0"><div class="font-bold truncate">${String(g.title||"Untitled").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</div><div class="text-xs text-slate-400 truncate">${String(g.category||"")} · ${String(g.url||"")}</div></div><button data-edit class="px-3 py-2 rounded-lg bg-cyan-600/20 text-cyan-200 border border-cyan-500/30 text-sm">এডিট</button><button data-delete class="px-3 py-2 rounded-lg bg-red-600/20 text-red-200 border border-red-500/30 text-sm">ডিলিট</button>`;
    row.querySelector("[data-delete]").onclick=async()=>{if(confirm(`“${g.title}” গেমটি ডিলিট করবেন?`)){await remove(ref(db,`games/${id}`));}};
    row.querySelector("[data-edit]").onclick=async()=>{
      const title=prompt("গেমের নাম",g.title||""); if(title===null)return;
      const url=prompt("গেম URL (https://)",g.url||""); if(url===null)return;
      const img=prompt("Thumbnail URL (খালি রাখা যাবে)",g.img||""); if(img===null)return;
      const category=prompt("Category: Action / Arcade / Puzzle / Racing",g.category||"Arcade"); if(category===null)return;
      if(!safeUrl(url)){alert("সঠিক https:// গেম URL দিন");return;}
      await update(ref(db,`games/${id}`),{title:title.trim(),url:safeUrl(url),img:safeUrl(img),category:category.trim()||"Arcade"});
      alert("গেম আপডেট হয়েছে।");
    };
    box.appendChild(row);
  });
});
onValue(bannersRef, snap => {
  const box=$("adminBannersList"); if(!box)return;
  const rows=snap.val()||{}; box.innerHTML="";
  if(!Object.keys(rows).length){box.innerHTML='<p class="text-sm text-slate-400">কোনো ব্যানার নেই।</p>';return;}
  Object.entries(rows).forEach(([id,b])=>{
    const el=document.createElement("div");el.className="flex gap-3 items-center p-3 rounded-xl bg-slate-800/70 border border-slate-700";
    el.innerHTML=`<img src="${safeUrl(b.img)||""}" class="w-24 h-16 object-cover rounded-lg"><div class="flex-1 min-w-0"><div class="font-bold truncate">${String(b.title||"Banner").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}</div><div class="text-xs text-slate-400 truncate">${String(b.img||"")}</div></div><button class="px-3 py-2 rounded-lg bg-red-600/20 text-red-200 border border-red-500/30 text-sm">ডিলিট</button>`;
    el.querySelector("button").onclick=async()=>{if(confirm(`“${b.title}” ব্যানারটি ডিলিট করবেন?`))await remove(ref(db,`banners/${id}`));};
    box.appendChild(el);
  });
});

$("togglePass").addEventListener("click", () => {
  const p = $("adminPass"), s = p.type === "password"; p.type = s ? "text" : "password";
  $("togglePass").innerHTML = `<i class="fa-regular fa-eye${s ? "-slash" : ""}"></i>`;
});

$("addGameForm").addEventListener("submit", async e => {
  e.preventDefault();
  let img = $("adminGameImg").value; const f = $("adminGameFile").files[0];
  if (f) { try { const fd = new FormData(); fd.append("image", f);
      const r = await (await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: fd })).json();
      if (r.success) img = r.data.url; } catch (err) { console.error(err); } }
  const url = safeUrl($("adminGameUrl").value); if (!url) return alert("সঠিক গেম URL দিন (https://...)");
  await push(ref(db, "games"), { title: $("adminGameTitle").value.trim(), category: $("adminGameCategory").value, img: safeUrl(img), url, timestamp: Date.now() });
  alert("গেমটি সফলভাবে সেভ হয়েছে!"); e.target.reset();
});
const bannerFileInput = $("bannerImageFile");
let bannerPreviewObjectUrl = "";
function clearBannerSelection() {
  if (bannerPreviewObjectUrl) URL.revokeObjectURL(bannerPreviewObjectUrl);
  bannerPreviewObjectUrl = ""; bannerFileInput.value = "";
  $("bannerImagePreview").classList.add("hidden"); $("bannerPreviewImg").removeAttribute("src");
}
bannerFileInput?.addEventListener("change", () => {
  const file = bannerFileInput.files?.[0]; if (!file) return;
  if (!file.type.startsWith("image/")) { clearBannerSelection(); adminNotice("error", "ছবির ফরম্যাট সঠিক নয়", "অনুগ্রহ করে PNG, JPG, WEBP অথবা GIF ছবি নির্বাচন করুন।"); return; }
  if (file.size > 32 * 1024 * 1024) { clearBannerSelection(); adminNotice("error", "ছবিটি অনেক বড়", "সর্বোচ্চ 32 MB আকারের ছবি আপলোড করতে পারবেন।"); return; }
  if (bannerPreviewObjectUrl) URL.revokeObjectURL(bannerPreviewObjectUrl);
  bannerPreviewObjectUrl = URL.createObjectURL(file); $("bannerPreviewImg").src = bannerPreviewObjectUrl;
  $("bannerFileName").textContent = file.name; $("bannerFileMeta").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB · আপলোডের জন্য প্রস্তুত`;
  $("bannerImagePreview").classList.remove("hidden");
});
$("clearBannerImage")?.addEventListener("click", clearBannerSelection);
$("addBannerForm").addEventListener("submit", async e => {
  e.preventDefault();
  const title = $("bannerTitle").value.trim(), file = bannerFileInput?.files?.[0];
  let img = safeUrl($("bannerImg").value);
  if (!title) { adminNotice("error", "টাইটেল প্রয়োজন", "ব্যানারের একটি নাম লিখুন।"); return; }
  if (!file && !img) { adminNotice("error", "ব্যানার ছবি নির্বাচন করুন", "গ্যালারি থেকে একটি ছবি বেছে নিন অথবা একটি বৈধ HTTPS ইমেজ URL দিন।"); return; }
  const submit = $("addBannerSubmit"), original = submit.innerHTML;
  submit.disabled = true; submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> ছবি আপলোড হচ্ছে…';
  try {
    if (file) {
      const fd = new FormData(); fd.append("image", file);
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`, { method: "POST", body: fd });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.url) throw new Error(result.error?.message || "ইমেজ হোস্টিং সার্ভার ছবিটি গ্রহণ করেনি।");
      img = safeUrl(result.data.url);
    }
    if (!img) throw new Error("ইমেজ থেকে বৈধ লিংক তৈরি করা যায়নি।");
    submit.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-2"></i> ব্যানার সেভ হচ্ছে…';
    await push(ref(db, "banners"), { title, img, createdAt: Date.now(), source: file ? "gallery" : "url" });
    e.target.reset(); clearBannerSelection();
    adminNotice("success", "ব্যানার সফলভাবে যুক্ত হয়েছে!", "আপনার ব্যানার আপলোড ও সেভ হয়েছে। এখন ওয়েবসাইটের ব্যানার সেকশনে এটি দেখা যাবে।");
  } catch (err) {
    console.error("Banner upload failed:", err);
    adminNotice("error", "ব্যানার যুক্ত করা যায়নি", err.message || "ইন্টারনেট, ImgBB API key এবং Firebase সংযোগ পরীক্ষা করে আবার চেষ্টা করুন।");
  } finally { submit.disabled = false; submit.innerHTML = original; }
});
$("resetLeaderboardBtn").addEventListener("click", async () => {
  if (!confirm("সব ইউজারের স্কোর শূন্য করতে চান?")) return;
  const snap = await getDocs(collection(fs, "users")); let b = writeBatch(fs), n = 0;
  for (const d of snap.docs) { b.update(d.ref, { totalScore: 0, bests: {} }); if (++n % 450 === 0) { await b.commit(); b = writeBatch(fs); } }
  await b.commit(); alert("লিডারবোর্ড রিসেট হয়েছে!");
});

// Mobile-friendly three-dot navigation for admin sections
const adminMenuToggle = document.getElementById('adminMenuToggle');
const adminQuickMenu = document.getElementById('adminQuickMenu');
if (adminMenuToggle && adminQuickMenu) {
  const closeAdminMenu = () => {
    adminQuickMenu.classList.add('hidden');
    adminMenuToggle.setAttribute('aria-expanded', 'false');
  };
  adminMenuToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const opening = adminQuickMenu.classList.contains('hidden');
    adminQuickMenu.classList.toggle('hidden', !opening);
    adminMenuToggle.setAttribute('aria-expanded', String(opening));
  });
  adminQuickMenu.addEventListener('click', (event) => {
    const link = event.target.closest('[data-admin-section]');
    if (!link) return;
    event.preventDefault();
    closeAdminMenu();
    setAdminSection(link.dataset.adminSection);
  });
  document.addEventListener('click', (event) => {
    if (!adminQuickMenu.contains(event.target) && !adminMenuToggle.contains(event.target)) closeAdminMenu();
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdminMenu(); });
}
