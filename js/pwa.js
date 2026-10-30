const installButton = document.getElementById('pwaInstallButton');
let deferredInstallPrompt = null;

function isStandaloneApp() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.navigator.standalone === true;
}
function syncInstallButton() {
  if (!installButton) return;
  installButton.classList.toggle('hidden', isStandaloneApp());
}
function showInstallHelp() {
  if (document.getElementById('pwaInstallHelp')) return;
  const wrap = document.createElement('div');
  wrap.id = 'pwaInstallHelp';
  wrap.className = 'pwa-help-backdrop';
  wrap.innerHTML = `<section class="pwa-help-card" role="dialog" aria-modal="true" aria-labelledby="pwaHelpTitle"><h2 id="pwaHelpTitle">PlayZone X ইনস্টল করুন</h2><p><b>Android / Chrome:</b> ব্রাউজারের ⋮ মেনু খুলে “Install app” অথবা “Add to Home screen” নির্বাচন করুন।<br><b>iPhone / Safari:</b> Share বাটনে চাপ দিয়ে “Add to Home Screen” নির্বাচন করুন।</p><button type="button" id="pwaHelpClose">ঠিক আছে</button></section>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  wrap.querySelector('#pwaHelpClose').addEventListener('click', close);
  wrap.addEventListener('click', event => { if (event.target === wrap) close(); });
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallButton();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  syncInstallButton();
});
if (installButton) installButton.addEventListener('click', async () => {
  if (isStandaloneApp()) { syncInstallButton(); return; }
  if (!deferredInstallPrompt) { showInstallHelp(); return; }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => null);
  deferredInstallPrompt = null;
  syncInstallButton();
});

syncInstallButton();
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', syncInstallButton);
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(error => console.warn('PWA service worker registration failed:', error)));
}
