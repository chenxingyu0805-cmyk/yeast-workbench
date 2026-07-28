/* ui.js — 通用 UI 助手（早于业务模块加载，供各模块共用） */
(function () {
  'use strict';
  const YW = (window.YW = window.YW || {});

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function modal(title) {
    const root = document.getElementById('modalRoot');
    root.classList.remove('hidden');
    root.innerHTML = `
      <div class="modal">
        <div class="modal-head"><h3>${esc(title)}</h3><button class="btn sm" id="mClose">✕</button></div>
        <div class="modal-body"></div>
        <div class="modal-foot"></div>
      </div>`;
    const body = root.querySelector('.modal-body');
    const foot = root.querySelector('.modal-foot');
    const close = () => { root.classList.add('hidden'); root.innerHTML = ''; };
    root.querySelector('#mClose').onclick = close;
    root.onclick = e => { if (e.target === root) close(); };
    return { root, body, foot, close };
  }
  function toast(msg) {
    let t = document.getElementById('__toast');
    if (!t) {
      t = document.createElement('div'); t.id = '__toast';
      t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1f2933;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:99;opacity:0;transition:opacity .2s;box-shadow:0 6px 20px rgba(0,0,0,.25)';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._tm); t._tm = setTimeout(() => { t.style.opacity = '0'; }, 1800);
  }

  YW.ui = { esc, fmtDate, modal, toast };
})();
