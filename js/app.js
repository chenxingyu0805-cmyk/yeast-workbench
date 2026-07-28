/* app.js — 导航 / 路由 / 数据备份（UI 助手在 ui.js 中已定义） */
(function () {
  'use strict';
  const DB = window.YWDB;
  const ui = window.YW.ui;
  const Views = (window.Views = window.Views || {});

  /* ---------- 数据备份视图 ---------- */
  async function backupView(app) {
    const counts = {};
    for (const s of DB.STORES) counts[s] = await DB.count(s);
    app.innerHTML = `
      <div class="view-head">
        <div><h2>数据备份</h2><div class="sub">数据存于本机浏览器；定期导出 JSON 以防丢失，可随时导入恢复</div></div>
      </div>
      <div class="detail">
        <div class="kv">
          <div class="k">菌株 / 底盘</div><div class="v">${counts.strains} 条</div>
          <div class="k">实验记录</div><div class="v">${counts.experiments} 条</div>
          <div class="k">引物</div><div class="v">${counts.primers} 条</div>
        </div>
        <div class="section-title">操作</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn primary" id="export">⬇ 导出全部 (JSON)</button>
          <button class="btn" id="import">⬆ 导入备份 (JSON)</button>
          <button class="btn danger" id="clear">🗑 清空全部数据</button>
        </div>
        <div class="hint" style="margin-top:12px">导出会把所有菌株、实验、引物打包成一个 JSON 文件，存到你自己的硬盘。导入会<b>覆盖</b>当前全部数据，请谨慎。</div>
        <input type="file" id="file" accept="application/json,.json" style="display:none" />
      </div>
    `;
    app.querySelector('#export').onclick = async () => {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yeast-workbench-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      ui.toast('已导出备份');
    };
    app.querySelector('#import').onclick = () => app.querySelector('#file').click();
    app.querySelector('#file').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        await DB.importAll(data);
        ui.toast('导入完成');
        backupView(app);
      } catch (err) { alert('导入失败：' + err.message); }
    };
    app.querySelector('#clear').onclick = async () => {
      if (!confirm('确认清空全部菌株、实验与引物数据？此操作不可撤销！建议先导出备份。')) return;
      for (const s of DB.STORES) await DB.clear(s);
      ui.toast('已清空'); backupView(app);
    };
  }
  Views.backup = { render: backupView };

  /* ---------- 路由 ---------- */
  function go(view) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    const app = document.getElementById('app');
    (Views[view] || Views.strains).render(app);
  }

  function init() {
    DB.init().then(() => {
      document.getElementById('dbStatus').textContent = '本地存储：就绪 ✓';
    }).catch(() => {
      document.getElementById('dbStatus').textContent = '本地存储：不可用';
    });
    // 注册离线 Service Worker（仅 http/https 安全上下文；file:// 与局域网 http IP 不会生效）
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    document.getElementById('nav').onclick = e => {
      const btn = e.target.closest('.tab-btn'); if (!btn) return;
      go(btn.dataset.view);
    };
    go('strains');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
