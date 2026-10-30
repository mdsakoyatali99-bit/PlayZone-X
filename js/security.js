(function () {
  const block = e => { e.preventDefault(); return false; };
  document.addEventListener('contextmenu', block);
  document.addEventListener('dragstart', block);
  document.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['i','j','c'].includes(k)) || (e.ctrlKey && ['u','s'].includes(k))) block(e);
  });
  if (window.top !== window.self) { try { window.top.location = window.self.location; } catch (_) { document.body.innerHTML = ''; } }
})();
