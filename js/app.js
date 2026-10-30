import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, get, runTransaction, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc, onSnapshot, collection, query, orderBy, where, limit, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig, MAX_SCORE, IMGBB_API_KEY, esc, safeUrl } from "./config.js";

const app = initializeApp(firebaseConfig), rtdb = getDatabase(app), fs = getFirestore(app), auth = getAuth(app);
const $ = id => document.getElementById(id);
let allGames = [], curCat = "All", curGame = null, adminInfo = null, lbDocs = [], me = null, activeSection = "games", authMode = "login", chatUnsub = null;
const t0 = Date.now(); let loaded = 0;
const ready = () => { if (++loaded >= 2) setTimeout(() => $("loader").classList.add("done"), Math.max(0, 2200 - (Date.now() - t0))); };
setTimeout(() => $("loader").classList.add("done"), 7000); // safety

// ---------- Firebase Authentication + unique usernames ----------
try { localStorage.removeItem("vg_user"); } catch {}
const RESERVED = /^(admin|administrator|owner|support|system|bot|অ্যাডমিন|এডমিন|ওনার)$/i;
const cleanName = n => String(n || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
const normUsername = n => cleanName(n).toLowerCase();
const isOwner = u => !!u && String(u.email || "").toLowerCase() === "mdsakoyatali99@gmail.com";
function saveMe(u) { me = u; if (u) localStorage.setItem("vg_user", JSON.stringify(u)); else localStorage.removeItem("vg_user"); paintUser(); renderLB(); }
onAuthStateChanged(auth, async user => {
  if (!user) { saveMe(null); return; }
  try {
    const profileRef = doc(fs, "users", user.uid), snap = await getDoc(profileRef);
    if (!snap.exists()) return; // Signup/login handlers create the profile after validating the account.
    const profile = snap.data();
    saveMe({ id:user.uid, uid:user.uid, email:user.email || "", name:profile.name || "Player", username:profile.username || profile.name || "Player", photoURL:profile.photoURL || user.photoURL || "", owner:isOwner(user) }); onSnapshot(doc(fs,"chatModeration",user.uid),snap=>{chatMuted=snap.exists()&&snap.data().muted===true;updateChatComposerState();},()=>{});
  } catch (e) { console.error("Profile sync failed", e); saveMe(null); }
});
const tag = id => "#" + id.slice(-4).toUpperCase();
function paintUser() { /* Profile is available from the bottom navigation. */ }
paintUser();
let favIds = new Set(); try { favIds = new Set(JSON.parse(localStorage.getItem("vg_favorites") || "[]")); } catch {}
window.showSection = (section, btn) => {
  activeSection = section;
  const fav = section === "favorites", board = section === "leaderboard", chat = section === "chat";
  $("favoritesSection").classList.toggle("hidden", !fav);
  $("gamesSection").classList.toggle("hidden", fav || board || chat);
  $("chatSection")?.classList.toggle("hidden", !chat);
  $("leaderboardSection").classList.toggle("hidden", !board);
  updateBannerVisibility();
  document.querySelectorAll(".category-btn").forEach(x => x.classList.toggle("hidden", fav || board || chat));
  if (btn) { document.querySelectorAll(".bottom-nav-item").forEach(x => x.classList.remove("active")); btn.classList.add("active"); }
  if (fav) renderFavorites();
  if (board) renderLB();
  if (chat && !me) openProfile();
  window.scrollTo({top:0,behavior:"smooth"});
};
window.toggleFavorite = (id, ev) => {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  favIds.has(id) ? favIds.delete(id) : favIds.add(id);
  localStorage.setItem("vg_favorites", JSON.stringify([...favIds]));
  applyFilter(); renderFavorites();
};
function renderFavorites() {
  const box = $("favoritesGrid"); if (!box) return;
  const old = $("gamesGrid"); const list = allGames.filter(g => favIds.has(g.id));
  box.innerHTML = "";
  if (!list.length) { box.innerHTML = '<p class="col-span-full text-center py-10 text-slate-400">এখনো কোনো প্রিয় গেম যোগ করেননি। গেম কার্ডের ♡ চাপুন।</p>'; return; }
  list.forEach(g => { const el = document.createElement("div"); el.className="glass-card rounded-2xl p-3 border border-slate-800";
    el.innerHTML = `<img class="w-full aspect-video object-cover rounded-xl mb-3" src="${esc(safeUrl(g.img)||"")}" alt=""><div class="font-bold truncate mb-3">${esc(g.title)}</div><div class="flex gap-2"><button class="flex-1 bg-violet-600 rounded-lg py-2 text-sm" data-play>খেলুন</button><button class="px-3 bg-slate-800 rounded-lg" data-remove><i class="fa-solid fa-heart-crack"></i></button></div>`;
    el.querySelector("[data-play]").onclick=()=>openGameModal(g); el.querySelector("[data-remove]").onclick=()=>toggleFavorite(g.id); box.appendChild(el); });
}

window.openProfile = () => {
  const b = $("profileBody");
  if (!me) {
    b.innerHTML = `<div class="text-center"><img src="assets/logo.svg" class="w-16 h-16 mx-auto mb-2"><h3 class="font-bold text-xl">PlayZone X অ্যাকাউন্ট</h3><p class="text-xs text-slate-400 mb-4">ইমেইল ও পাসওয়ার্ড দিয়ে নিরাপদে ${authMode === "signup" ? "সাইন-আপ" : "লগইন"} করুন</p>
      <div class="auth-tabs"><button class="${authMode === "login" ? "active" : ""}" onclick="switchAuthMode('login')">লগইন</button><button class="${authMode === "signup" ? "active" : ""}" onclick="switchAuthMode('signup')">সাইন-আপ</button></div>
      ${authMode === "signup" ? `<input id="usernameIn" maxlength="20" autocomplete="username" placeholder="ইউজারনেম (ইউনিক)" class="w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500">` : ""}
      <input id="emailIn" type="email" autocomplete="email" placeholder="ইমেইল ঠিকানা" class="w-full mb-2 bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500">
      <input id="passwordIn" type="password" minlength="6" autocomplete="${authMode === "signup" ? "new-password" : "current-password"}" placeholder="পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)" class="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500">
      <div id="nameMsg" class="text-xs text-rose-300 mt-2 min-h-[1rem]" role="status"></div>
      <button onclick="doLogin()" class="w-full mt-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl py-2.5 font-semibold">${authMode === "signup" ? "অ্যাকাউন্ট তৈরি করুন" : "লগইন করুন"}</button>
      <p class="text-[11px] text-slate-500 mt-3">ইউজারনেম ইউনিক হতে হবে। ইমেইল Firebase Authentication-এ যাচাই হবে।</p></div>`;
  } else {
    b.innerHTML = `<div class="text-center">${me.photoURL && safeUrl(me.photoURL) ? `<img src="${esc(safeUrl(me.photoURL))}" class="av mx-auto" style="width:76px;height:76px;font-size:26px" alt="Profile photo">` : `<div class="av mx-auto" style="width:76px;height:76px;font-size:26px">${esc((me.name||"P")[0].toUpperCase())}</div>`}
      ${me.owner ? `<div class="owner-glass-badge mx-auto mt-3"><i class="fa-solid fa-crown"></i> VERIFIED OWNER</div>` : ""}
      <label for="profilePhotoInput" class="inline-flex items-center gap-2 mt-3 mb-1 px-4 py-2 rounded-xl bg-violet-600/20 border border-violet-400/30 text-violet-200 text-sm font-semibold cursor-pointer"><i class="fa-solid fa-camera"></i> গ্যালারি থেকে ছবি দিন</label><input id="profilePhotoInput" type="file" accept="image/jpeg,image/png,image/webp" class="hidden"><p class="text-[11px] text-slate-500 mb-2">JPG, PNG বা WebP • সর্বোচ্চ 5 MB</p><div id="photoMsg" class="text-xs text-slate-400 mb-2 min-h-[1rem]"></div>
      <p class="text-xs text-slate-400">ইউজার আইডি: <span class="font-mono">${esc(me.id)}</span></p><p class="text-xs text-slate-400 mt-1">${esc(me.email || "")}</p>
      <input id="nameIn" maxlength="20" value="${esc(me.name)}" class="w-full mt-3 bg-slate-800 border border-slate-700 rounded-xl p-3 text-center text-white focus:outline-none focus:border-purple-500">
      <div id="nameMsg" class="text-xs text-rose-300 mt-2 min-h-[1rem]"></div><button onclick="doRename()" class="w-full mt-1 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl py-2.5 font-semibold">নাম সেভ করুন</button>
      <button onclick="doLogout()" class="w-full mt-2 bg-slate-800 border border-slate-700 rounded-xl py-2 text-sm text-slate-300">লগআউট</button></div>`;
  }
  $("profileModal").classList.remove("hidden"); const photoInput = $("profilePhotoInput"); if (photoInput) photoInput.onchange = uploadProfilePhoto;
};
window.switchAuthMode = mode => { authMode = mode === "signup" ? "signup" : "login"; openProfile(); };
async function uploadProfilePhoto(e) {
  const file = e.target.files && e.target.files[0]; if (!file || !me) return; const msg = $("photoMsg");
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 5 * 1024 * 1024) { if (msg) msg.textContent = "JPG, PNG বা WebP ছবি দিন (সর্বোচ্চ 5 MB)।"; e.target.value = ""; return; }
  if (msg) msg.textContent = "ছবি আপলোড হচ্ছে…";
  try { const fd = new FormData(); fd.append("image", file); const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(IMGBB_API_KEY)}`, {method:"POST",body:fd}); const result = await response.json(); if (!response.ok || !result.success || !result.data?.url) throw new Error("upload_failed"); const photoURL = safeUrl(result.data.url); if (!photoURL) throw new Error("bad_url"); await updateDoc(doc(fs,"users",me.id),{photoURL}); me.photoURL=photoURL; saveMe(me); openProfile(); } catch (err) { console.error(err); if (msg) msg.textContent = "আপলোড ব্যর্থ। ইন্টারনেট/API key ও Firebase Rules যাচাই করুন।"; }
}
window.doLogin = async () => {
  const status = $("nameMsg"); if (!status) return;
  const email = String($("emailIn")?.value || "").trim().toLowerCase(), password = String($("passwordIn")?.value || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { status.textContent = "সঠিক ইমেইল ঠিকানা দিন।"; return; }
  if (password.length < 6) { status.textContent = "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।"; return; }
  status.textContent = authMode === "signup" ? "অ্যাকাউন্ট তৈরি হচ্ছে…" : "লগইন হচ্ছে…";
  try {
    if (authMode === "signup") {
      const username = cleanName($("usernameIn")?.value || ""), key = normUsername(username);
      if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username) || RESERVED.test(username)) { status.textContent = "ইউজারনেম ৩–২০ অক্ষরের দিন; অক্ষর, সংখ্যা, _ . - ব্যবহার করুন।"; return; }
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const reserve = await runTransaction(ref(rtdb, `usernames/${key}`), current => current === null ? cred.user.uid : undefined);
      if (!reserve.committed) { const { deleteUser } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"); await deleteUser(cred.user); await signOut(auth); status.textContent = "এই ইউজারনেমটি আগে থেকেই নেওয়া হয়েছে। অন্য নাম দিন।"; return; }
      try {
        await updateProfile(cred.user, {displayName:username});
        await setDoc(doc(fs,"users",cred.user.uid), {name:username, username, totalScore:0, bests:{}, photoURL:"", createdAt:serverTimestamp(), lastActiveAt:serverTimestamp()});
      } catch (profileError) {
        try { await remove(ref(rtdb, `usernames/${key}`)); } catch {}
        try { const { deleteUser } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js"); await deleteUser(cred.user); } catch {}
        throw profileError;
      }
      me = {id:cred.user.uid,uid:cred.user.uid,email,name:username,username,photoURL:"",owner:isOwner(cred.user)}; saveMe(me); authMode="login"; closeModal("profileModal"); openProfile();
    } else {
      const cred = await signInWithEmailAndPassword(auth,email,password), profile = await getDoc(doc(fs,"users",cred.user.uid));
      if (!profile.exists()) { let username=cleanName(cred.user.displayName || email.split("@")[0]).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0,20); if(username.length<3) username=`Player${cred.user.uid.slice(0,5)}`; await setDoc(doc(fs,"users",cred.user.uid),{name:username,username,totalScore:0,bests:{},photoURL:cred.user.photoURL||"",createdAt:serverTimestamp(),lastActiveAt:serverTimestamp()}); }
      const snap=await getDoc(doc(fs,"users",cred.user.uid)), d=snap.data()||{}; me={id:cred.user.uid,uid:cred.user.uid,email,name:d.name||cred.user.displayName||email.split("@")[0],username:d.username||d.name||"Player",photoURL:d.photoURL||cred.user.photoURL||"",owner:isOwner(cred.user)}; saveMe(me); closeModal("profileModal"); openProfile();
    }
  } catch (e) { console.error(e); const code=e.code||""; status.textContent = code.includes("email-already-in-use") ? "এই ইমেইলে অ্যাকাউন্ট আছে—লগইন করুন।" : code.includes("weak-password") ? "আরও শক্তিশালী পাসওয়ার্ড দিন।" : code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found") ? "ইমেইল বা পাসওয়ার্ড সঠিক নয়।" : code.includes("operation-not-allowed") ? "Firebase Console-এ Email/Password sign-in চালু করুন।" : "ব্যর্থ হয়েছে। Firebase Rules, Authentication সেটিংস ও ইন্টারনেট যাচাই করুন।"; }
};
window.doRename = async () => { const name=cleanName($("nameIn").value); if(name.length<2||name.length>20||RESERVED.test(name)){ $("nameMsg").textContent="নাম ২–২০ অক্ষরের দিন; সংরক্ষিত নাম ব্যবহার করবেন না।"; return; } try { await updateDoc(doc(fs,"users",me.id),{name}); me.name=name; saveMe(me); closeModal("profileModal"); renderLB(); } catch { $("nameMsg").textContent="সেভ ব্যর্থ—Firebase Rules যাচাই করুন।"; } };
window.doLogout = async () => { try { await signOut(auth); } finally { saveMe(null); closeModal("profileModal"); renderLB(); } };
window.closeModal = id => $(id).classList.add("hidden");

// ---------- Score ----------
let myBests = {}, lastSubmit = 0;
window.submitScorePrompt = () => {
  if (!me) { openProfile(); return; }
  $("scoreGame").textContent = curGame ? curGame.title : ""; $("scoreInput").value = ""; $("scoreMsg").textContent = "";
  $("scoreModal").classList.remove("hidden");
};
window.saveScore = async () => {
  const s = Math.floor(Number($("scoreInput").value));
  if (!Number.isFinite(s) || s <= 0 || s > MAX_SCORE) { $("scoreMsg").textContent = `স্কোর ১ থেকে ${MAX_SCORE.toLocaleString("bn-BD")} এর মধ্যে দিন`; return; }
  if (Date.now() - lastSubmit < 15000) { $("scoreMsg").textContent = "১৫ সেকেন্ড পর আবার চেষ্টা করুন"; return; }
  const bests = { ...myBests }; bests[curGame.id] = Math.max(bests[curGame.id] || 0, s);
  const totalScore = Object.values(bests).reduce((a, b) => a + b, 0);
  try { await updateDoc(doc(fs, "users", me.id), { bests, totalScore }); lastSubmit = Date.now(); closeModal("scoreModal"); }
  catch { $("scoreMsg").textContent = "সাবমিট ব্যর্থ হয়েছে"; }
};

// ---------- Leaderboard (Firestore realtime, top 100) ----------
onSnapshot(query(collection(fs, "users"), where("totalScore", ">", 0), orderBy("totalScore", "desc"), limit(100)),
  s => { lbDocs = s.docs.map(d => ({ id: d.id, ...d.data() })); const m = lbDocs.find(u => me && u.id === me.id); if (m) myBests = m.bests || {}; renderLB(); ready(); },
  () => ready());
onSnapshot(doc(fs, "config", "admin"), s => { adminInfo = s.exists() ? s.data() : null; renderLB(); });

const nf = n => Number(n).toLocaleString("bn-BD");
function avatarHue(seed){let h=0;for(const ch of String(seed||"player"))h=(h*31+ch.charCodeAt(0))|0;return ((h>>>0)%360);}
const avatar = (u, big) => {
  const style = big ? "width:56px;height:56px;font-size:20px" : "";
  return u.photoURL && safeUrl(u.photoURL)
    ? `<img src="${esc(safeUrl(u.photoURL))}" alt="${esc(u.name || "Player")}" referrerpolicy="no-referrer" class="av" style="${style}" loading="lazy">`
    : `<div class="av avatar-color" style="${style};--avatar-hue:${avatarHue(u.id||u.uid||u.username||u.name)}deg">${esc((u.name || u.username || "?").trim().charAt(0).toUpperCase())}</div>`;
};
function renderLB() {
  const ab = $("adminBoard");
  if (!ab || !$("podium") || !$("leaderboardList")) return;
  ab.innerHTML = adminInfo ? `<div class="admin-card"><div class="p-4 flex items-center gap-3">
    ${adminInfo.photoURL && safeUrl(adminInfo.photoURL) ? `<img src="${esc(safeUrl(adminInfo.photoURL))}" referrerpolicy="no-referrer" class="av" style="width:56px;height:56px;margin:0">` : avatar({ name: adminInfo.displayName }, true)}
    <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><i class="fa-solid fa-crown text-amber-300"></i><span class="font-bold text-lg truncate bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-pink-300 to-cyan-300">${esc(adminInfo.displayName || "Admin")}</span></div>
    <div class="text-[11px] text-slate-300 mt-0.5">ID: ${esc(String(adminInfo.uid || "").slice(0, 8))}…</div></div>
    <span class="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 tracking-wider">OWNER</span></div></div>` : "";
  const top = lbDocs.slice(0, 3), order = [1, 0, 2], medal = ["🥇", "🥈", "🥉"];
  const emptyBoard = $("leaderboardEmpty"); if (emptyBoard) emptyBoard.classList.toggle("hidden", lbDocs.length > 0);
  $("podium").innerHTML = top.length ? order.filter(i => top[i]).map(i => { const u = top[i];
    return `<div class="pod r${i + 1} rank-premium rank-${i+1}"><div class="text-2xl">${medal[i]}</div>${avatar(u)}<div class="text-xs font-bold truncate px-1">${esc(u.name)}${!!adminInfo && u.id === adminInfo.uid ? ` <span class="owner-inline">OWNER</span>` : ""}</div><div class="text-[10px] text-slate-400">${esc(tag(u.id))}</div><div class="text-sm font-bold text-amber-300 mt-1">${nf(u.totalScore)}</div></div>`; }).join("")
    : `<p class="text-center text-slate-500 text-sm py-6 w-full">এখনো কেউ স্কোর দেয়নি। প্রথম হোন! 🚀</p>`;
  $("leaderboardList").innerHTML = lbDocs.slice(3).map((u, i) => `<div class="lb-row ${me && u.id === me.id ? "me" : ""}"><span class="w-8 text-center text-sm font-bold text-slate-400">${nf(i + 4)}</span>
    ${avatar(u, false).replace('width:44px;height:44px;', 'width:34px;height:34px;').replace('margin:0 auto 4px', 'margin:0').replace('font-size:13px','font-size:13px')}<div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${esc(u.name)}${!!adminInfo && u.id === adminInfo.uid ? ` <span class="owner-inline">OWNER</span>` : ""}</div><div class="text-[10px] text-slate-500">${esc(tag(u.id))}</div></div>
    <span class="text-sm font-bold text-amber-300">${nf(u.totalScore)}</span></div>`).join("");
}

// ---------- Global chat + emoji picker + scheduled system bot ----------
const chatBox = $("chatMessages"), chatInput = $("chatInput");
const chatEmojis = ["😀","😂","🥹","😍","😎","🔥","💜","❤️","🎮","🏆","👏","😭","😡","✨","🚀","👍","💯","🤝"];
function chatAvatar(name, photo, uid) { return photo && safeUrl(photo) ? `<img class="chat-avatar" src="${esc(safeUrl(photo))}" alt="">` : `<span class="chat-avatar avatar-color" style="--avatar-hue:${avatarHue(uid||name)}deg">${esc((name||"U").trim().charAt(0).toUpperCase())}</span>`; }
function renderChat(snapshot) {
  if (!chatBox) return; const rows = snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.createdAt?.toMillis?.()||0)-(b.createdAt?.toMillis?.()||0));
  chatBox.innerHTML = rows.map(m=>{ const owner=m.role!=="bot" && m.owner===true; const bot=m.role==="bot"; const mine=!!me && m.uid===me.id && !bot; const rank=lbDocs.findIndex(u=>u.id===m.uid); const rankClass=rank===0?"chat-rank-1":rank===1?"chat-rank-2":rank===2?"chat-rank-3":""; const identity=owner?`<span class="owner-glass-badge"><i class="fa-solid fa-crown"></i> OWNER</span>`:bot?`<span class="bot-badge">AUTO BOT</span>`:rank>=0&&rank<3?`<span class="rank-badge rank-badge-${rank+1}">#${rank+1}</span>`:""; return `<article class="chat-message ${mine?"chat-message-mine":"chat-message-other"} ${owner?"chat-owner":""} ${bot?"chat-bot":""} ${rankClass}">${mine?"":chatAvatar(m.username||m.name||(bot?"B":"U"),m.photoURL,m.uid)}<div class="chat-message-body"><div class="chat-message-head">${mine?"":`<strong>${esc(bot?"PlayZone Bot":m.username||m.name||"Player")}</strong>${identity}`}<time>${m.createdAt?.toDate?m.createdAt.toDate().toLocaleTimeString("bn-BD",{hour:"2-digit",minute:"2-digit"}):"এখন"}</time></div><p>${esc(m.message||"")}</p></div></article>`; }).join(""); chatBox.scrollTop=chatBox.scrollHeight;
}
let chatDisabled = false, chatMuted = false;
if (chatBox) onSnapshot(query(collection(fs,"globalChat"),orderBy("createdAt","desc"),limit(80)), snap=>renderChat(snap), err=>{console.warn("Chat unavailable",err);chatBox.innerHTML='<p class="chat-empty">চ্যাট লোড হয়নি। Firebase Rules আপডেট করুন।</p>';});
onSnapshotChatSettings();
function onSnapshotChatSettings(){
  onSnapshot(doc(fs,"chatSettings","global"),snap=>{chatDisabled=snap.exists()&&snap.data().enabled===false;updateChatComposerState();},()=>{});
  if(me?.id) onSnapshot(doc(fs,"chatModeration",me.id),snap=>{chatMuted=snap.exists()&&snap.data().muted===true;updateChatComposerState();},()=>{});
}
function updateChatComposerState(){if(chatInput){chatInput.disabled=chatDisabled||chatMuted;chatInput.placeholder=chatDisabled?"চ্যাট সাময়িকভাবে বন্ধ আছে…":chatMuted?"আপনাকে চ্যাট থেকে মিউট করা হয়েছে…":"আপনার মেসেজ লিখুন…";}const b=document.querySelector(".chat-send");if(b)b.disabled=chatDisabled||chatMuted;const st=$("chatStatus");if(st)st.textContent=chatDisabled?"অ্যাডমিন চ্যাট সাময়িকভাবে বন্ধ রেখেছেন।":chatMuted?"আপনার অ্যাকাউন্টটি চ্যাট থেকে মিউট করা হয়েছে।":"ব্যক্তিগত তথ্য, পাসওয়ার্ড বা অনুপযুক্ত মেসেজ শেয়ার করবেন না।";}

window.toggleEmojiPicker = () => { const p=$("emojiPicker"); if(!p)return; p.classList.toggle("hidden"); if(!p.dataset.ready){p.innerHTML=chatEmojis.map(e=>`<button type="button" class="emoji-choice" data-emoji="${e}">${e}</button>`).join("");p.querySelectorAll("[data-emoji]").forEach(b=>b.onclick=()=>{if(chatInput){chatInput.value+=b.dataset.emoji;chatInput.focus();}p.classList.add("hidden");});p.dataset.ready="1";} };
window.sendChatMessage = async e => { if(e)e.preventDefault(); if(chatDisabled||chatMuted){updateChatComposerState();return;} if(!me){openProfile();return;} const message=String(chatInput?.value||"").trim(); if(!message)return; if(message.length>400){alert("মেসেজ সর্বোচ্চ ৪০০ অক্ষরের হতে পারে।");return;} try { const { addDoc }=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js"); await addDoc(collection(fs,"globalChat"),{uid:me.id,username:me.username||me.name,name:me.name,owner:!!me.owner,photoURL:me.photoURL||"",message,role:"user",createdAt:serverTimestamp()}); chatInput.value=""; $("emojiPicker")?.classList.add("hidden"); } catch(err){console.error(err);alert("মেসেজ পাঠানো যায়নি। Firebase Rules যাচাই করুন।");} };
if (chatInput) chatInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();window.sendChatMessage();}});
const botMessages=["🎮 PlayZone X-এ সবাইকে স্বাগতম! ভদ্রভাবে চ্যাট করুন।","🏆 আজকের চ্যালেঞ্জ: খেলুন, পয়েন্ট অর্জন করুন, লিডারবোর্ডে উঠুন!","💜 আপনার প্রিয় গেম কোনটি? চ্যাটে জানান!","✨ নতুন বন্ধুদের স্বাগতম—গেমিং মজা উপভোগ করুন!"];
async function ensureAutoBotMessage(){if(!me)return;const bucket=Math.floor(Date.now()/(10*60*1000));const id=`bot_${bucket}`;try{const {setDoc}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");await setDoc(doc(fs,"globalChat",id),{uid:"system",username:"PlayZone Bot",name:"PlayZone Bot",message:botMessages[bucket%botMessages.length],role:"bot",createdAt:serverTimestamp()},{merge:false});}catch(e){/* Rules may be awaiting deployment; bot remains non-blocking. */}}
setTimeout(()=>{ensureAutoBotMessage();setInterval(ensureAutoBotMessage,10*60*1000);},3000);

// ---------- Games & banners (Realtime DB, unchanged data) ----------
onValue(ref(rtdb, "games"), s => { const d = s.val(); allGames = d ? Object.entries(d).map(([id, g]) => ({ id, ...g })) : []; applyFilter(); renderFavorites(); ready(); }, () => ready());
function applyFilter() {
  const q = ($("searchInput").value || "").toLowerCase();
  renderGames(allGames.filter(g => (curCat === "All" || g.category === curCat) && (g.title || "").toLowerCase().includes(q)));
}
$("searchInput").addEventListener("input", applyFilter);
window.filterCategory = c => { curCat = c; document.querySelectorAll(".category-btn").forEach(b => b.classList.toggle("active", b.getAttribute("onclick").includes(`'${c}'`))); applyFilter(); };
function renderGames(list) {
  const grid = $("gamesGrid");
  if (!list.length) { grid.innerHTML = `<div class="col-span-full text-center py-12 text-slate-500 text-sm">কোনো গেম পাওয়া যায়নি।</div>`; return; }
  grid.innerHTML = ""; const ph = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='200'><rect width='300' height='200' fill='%231e293b'/></svg>";
  list.forEach(g => {
    const c = document.createElement("div");
    c.className = "game-card glass-card rounded-2xl overflow-hidden border border-slate-800 cursor-pointer group flex flex-col";
    c.onclick = () => openGameModal(g);
    c.innerHTML = `<div class="relative w-full pt-[75%] overflow-hidden bg-slate-900"><img src="${esc(safeUrl(g.img) || ph)}" alt="${esc(g.title)}" referrerpolicy="no-referrer" class="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"><div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
      <button class="fav-btn" aria-label="প্রিয় গেম" onclick="toggleFavorite('${g.id}',event)"><i class="fa-${favIds.has(g.id) ? "solid" : "regular"} fa-heart"></i></button><span class="absolute top-2 left-2 px-2 py-0.5 bg-slate-950/80 border border-slate-700/80 rounded-md text-[10px] font-bold text-purple-300 uppercase tracking-wider">${esc(g.category)}</span></div>
      <div class="p-3 flex items-center justify-between bg-slate-900/90"><h3 class="font-bold text-slate-200 text-sm truncate">${esc(g.title)}</h3><div class="w-7 h-7 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center group-hover:bg-purple-600 transition-all"><i class="fa-solid fa-play text-xs text-purple-300 group-hover:text-white"></i></div></div>`;
    grid.appendChild(c);
  });
}
let bannerItems = [], bannerIndex = 0, bannerTimer = null;
function updateBannerVisibility() {
  const box = $("bannerContainer"); if (!box) return;
  // Banners belong only to the Home/Games screen. Realtime banner updates must not
  // make them reappear while the user is browsing Favorites or the Leaderboard.
  box.classList.toggle("hidden", activeSection !== "games" || bannerItems.length === 0);
}
function renderBannerSlide() {
  const box = $("bannerContainer"); if (!box) return;
  if (!bannerItems.length) { box.innerHTML = ""; clearInterval(bannerTimer); updateBannerVisibility(); return; }
  bannerIndex = ((bannerIndex % bannerItems.length) + bannerItems.length) % bannerItems.length;
  const b = bannerItems[bannerIndex];
  box.innerHTML = `<div class="banner-slide" aria-roledescription="slide"><img src="${esc(safeUrl(b.img))}" alt="${esc(b.title || "PlayZone banner")}" referrerpolicy="no-referrer"><div class="banner-shade"></div><div class="banner-caption"><span class="banner-kicker">PLAYZONE X • FEATURED</span><h2>${esc(b.title || "Featured Games")}</h2></div>${bannerItems.length > 1 ? `<button class="banner-arrow prev" aria-label="আগের ব্যানার"><i class="fa-solid fa-chevron-left"></i></button><button class="banner-arrow next" aria-label="পরের ব্যানার"><i class="fa-solid fa-chevron-right"></i></button><div class="banner-dots">${bannerItems.map((_,i)=>`<button aria-label="ব্যানার ${i+1}" class="banner-dot ${i===bannerIndex?"active":""}" data-slide="${i}"></button>`).join("")}</div>` : ""}</div>`;
  box.querySelector(".prev")?.addEventListener("click",()=>{bannerIndex--;renderBannerSlide();restartBannerTimer();});
  box.querySelector(".next")?.addEventListener("click",()=>{bannerIndex++;renderBannerSlide();restartBannerTimer();});
  box.querySelectorAll("[data-slide]").forEach(btn=>btn.addEventListener("click",()=>{bannerIndex=Number(btn.dataset.slide);renderBannerSlide();restartBannerTimer();}));
  updateBannerVisibility();
}
function restartBannerTimer(){clearInterval(bannerTimer);if(bannerItems.length>1)bannerTimer=setInterval(()=>{bannerIndex=(bannerIndex+1)%bannerItems.length;renderBannerSlide();},5000);}
onValue(ref(rtdb, "banners"), s => {
  const d = s.val(); bannerItems = d ? Object.values(d).filter(b => safeUrl(b.img)) : []; bannerIndex = 0;
  renderBannerSlide(); restartBannerTimer();
});

let activeSince = 0, activeMilliseconds = 0, lastTickAt = 0, lastAwardedMinute = 0, playTimer = null, sessionId = 0;
const gameModal = $("gameModal"), gameFrame = $("gameIframe");
window.openGameModal = async g => {
  const u = safeUrl(g.url); if (!u) return;
  if (!me) { openProfile(); return; }
  curGame = g; activeSince = Date.now(); activeMilliseconds = 0; lastTickAt = Date.now(); lastAwardedMinute = 0; sessionId++; history.pushState({playingGame:true}, "", "#playing");
  const thisSession = sessionId;
  gameFrame.src = u; gameModal.classList.remove("hidden"); document.body.classList.add("playing-game");
  // Attempt browser fullscreen directly from the user's click. Some browsers require another gesture.
  try { if (gameModal.requestFullscreen) await gameModal.requestFullscreen(); } catch {}
  clearInterval(playTimer);
  playTimer = setInterval(async () => {
    if (thisSession !== sessionId || !me || gameModal.classList.contains("hidden") || document.hidden || !curGame) return;
    // Award only for time the portal tab remains visible; this tracks presence, not in-game actions.
    const now = Date.now();
    if (!document.hidden && document.hasFocus()) activeMilliseconds += Math.min(now - lastTickAt, 7000);
    lastTickAt = now;
    const elapsed = Math.floor(activeMilliseconds / 60000);
    if (elapsed > lastAwardedMinute) {
      const add = elapsed - lastAwardedMinute; lastAwardedMinute = elapsed;
      try { await updateDoc(doc(fs, "users", me.id), { totalScore: increment(add), lastActiveAt: serverTimestamp(), lastPlayedGame: curGame.id }); }
      catch (e) { console.warn("Session points not saved", e); }
    }
  }, 5000);
};
window.closeGameModal = async () => {
  clearInterval(playTimer); playTimer = null; sessionId++;
  gameFrame.src = "about:blank"; gameModal.classList.add("hidden"); document.body.classList.remove("playing-game");
  try { if (document.fullscreenElement) await document.exitFullscreen(); } catch {}
  curGame = null;
};
window.toggleFullscreen = () => { if (gameModal.requestFullscreen) gameModal.requestFullscreen().catch(()=>{}); };
window.toggleLeaderboardModal = () => window.showSection("leaderboard", document.querySelector('.bottom-nav-item[onclick*="leaderboard"]'));
document.addEventListener("keydown", e => { if (e.key === "Escape" && !gameModal.classList.contains("hidden")) window.closeGameModal(); });
window.addEventListener("popstate", () => { if (!gameModal.classList.contains("hidden")) window.closeGameModal(); });
