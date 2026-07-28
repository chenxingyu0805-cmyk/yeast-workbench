/* strains.js — 菌株 / 底盘库模块 */
(function () {
  'use strict';
  const Views = (window.Views = window.Views || {});
  const DB = window.YWDB, ui = window.YW.ui;

  let state = { list: [], search: '', tag: '' };

  async function load() {
    state.list = await DB.getAll('strains');
  }

  function allTags() {
    const set = new Set();
    state.list.forEach(s => (s.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    return state.list.filter(s => {
      if (state.tag && !(s.tags || []).includes(state.tag)) return false;
      if (!q) return true;
      const hay = [s.code, s.name, s.genotype, s.source, s.method, s.markers, s.location, (s.tags || []).join(' '), s.notes].join(' ').toLowerCase();
      return hay.includes(q);
    }).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  function render(app) {
    load().then(() => {
      const items = filtered();
      const tags = allTags();
      const html = `
        <div class="view-head">
          <div><h2>菌株 / 底盘库</h2><div class="sub">记录酵母底盘、工程菌株的基因型、谱系与保藏信息</div></div>
          <button class="btn primary" id="newStrain">+ 新建菌株</button>
        </div>
        <div class="toolbar">
          <input id="search" placeholder="搜索编号 / 基因型 / 标记 / 备注…" value="${ui.esc(state.search)}" style="max-width:320px" />
          <select id="tagFilter" style="max-width:180px">
            <option value="">全部标签</option>
            ${tags.map(t => `<option value="${ui.esc(t)}" ${state.tag === t ? 'selected' : ''}>${ui.esc(t)}</option>`).join('')}
          </select>
          <span class="pill">${items.length} / ${state.list.length} 株</span>
        </div>
        ${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : `<div class="empty">还没有菌株记录，点右上角「新建菌株」开始。</div>`}
      `;
      app.innerHTML = html;
      app.querySelector('#newStrain').onclick = () => editForm(null);
      app.querySelector('#search').oninput = e => { state.search = e.target.value; refreshList(app); };
      app.querySelector('#tagFilter').onchange = e => { state.tag = e.target.value; refreshList(app); };
      app.querySelectorAll('.card').forEach(c => c.onclick = () => openDetail(app, c.dataset.id));
    });
  }

  function refreshList(app) {
    // 仅重渲染列表区，保持输入框焦点
    const items = filtered();
    const tags = allTags();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div class="toolbar">
          <input id="search" placeholder="搜索编号 / 基因型 / 标记 / 备注…" value="${ui.esc(state.search)}" style="max-width:320px" />
          <select id="tagFilter" style="max-width:180px">
            <option value="">全部标签</option>
            ${tags.map(t => `<option value="${ui.esc(t)}" ${state.tag === t ? 'selected' : ''}>${ui.esc(t)}</option>`).join('')}
          </select>
          <span class="pill">${items.length} / ${state.list.length} 株</span>
        </div>
        ${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : `<div class="empty">没有匹配的菌株。</div>`}
    `;
    // 替换 toolbar + grid：简单起见整体替换 view-head 之后部分
    const head = app.querySelector('.view-head');
    app.innerHTML = '';
    app.appendChild(head);
    while (wrap.firstChild) app.appendChild(wrap.firstChild);
    app.querySelector('#search').oninput = e => { state.search = e.target.value; refreshList(app); };
    app.querySelector('#tagFilter').onchange = e => { state.tag = e.target.value; refreshList(app); };
    app.querySelector('#newStrain').onclick = () => editForm(null);
    app.querySelectorAll('.card').forEach(c => c.onclick = () => openDetail(app, c.dataset.id));
  }

  function card(s) {
    const parent = s.parentId ? state.list.find(x => x.id === s.parentId) : null;
    return `
      <div class="card" data-id="${s.id}">
        <div class="code">${ui.esc(s.code || '—')}</div>
        <h3>${ui.esc(s.name || '未命名菌株')}</h3>
        <div class="meta">
          <div>基因型：${ui.esc((s.genotype || '').slice(0, 60) || '—')}</div>
          <div>来源：${ui.esc(s.source || '—')} · 方法：${ui.esc(s.method || '—')}</div>
          ${parent ? `<div>亲本：${ui.esc(parent.code || parent.name)}</div>` : ''}
          <div>保藏：${ui.esc(s.location || '—')}</div>
        </div>
        ${(s.tags || []).length ? `<div class="tags">${s.tags.map(t => `<span class="chip green">${ui.esc(t)}</span>`).join('')}</div>` : ''}
      </div>`;
  }

  async function openDetail(app, id) {
    const s = await DB.get('strains', id);
    if (!s) return;
    const all = await DB.getAll('strains');
    const exps = (await DB.getAll('experiments')).filter(e => (e.strainIds || []).includes(id))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    // 谱系（向上回溯）
    const chain = [];
    let cur = s;
    while (cur) { chain.push(cur); cur = cur.parentId ? all.find(x => x.id === cur.parentId) : null; }

    const html = `
      <div class="view-head">
        <div><h2>${ui.esc(s.name || '未命名菌株')}</h2><div class="sub">菌株编号 ${ui.esc(s.code || '—')}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="back">← 返回列表</button>
          <button class="btn accent" id="newExp">+ 关联实验</button>
          <button class="btn" id="edit">编辑</button>
          <button class="btn danger" id="del">删除</button>
        </div>
      </div>
      <div class="detail">
        <div class="row"><div class="k">编号</div><div class="v">${ui.esc(s.code || '—')}</div></div>
        <div class="row"><div class="k">名称</div><div class="v">${ui.esc(s.name || '—')}</div></div>
        <div class="row"><div class="k">基因型 / 编辑位点</div><div class="v mono">${ui.esc(s.genotype || '—')}</div></div>
        <div class="row"><div class="k">筛选标记</div><div class="v">${ui.esc(s.markers || '—')}</div></div>
        <div class="row"><div class="k">构建方法</div><div class="v">${ui.esc(s.method || '—')}</div></div>
        <div class="row"><div class="k">来源</div><div class="v">${ui.esc(s.source || '—')}</div></div>
        <div class="row"><div class="k">保藏位置</div><div class="v">${ui.esc(s.location || '—')}</div></div>
        <div class="row"><div class="k">备注</div><div class="v">${ui.esc(s.notes || '—')}</div></div>
        <div class="row"><div class="k">创建 / 更新</div><div class="v">${ui.fmtDate(s.createdAt)} / ${ui.fmtDate(s.updatedAt)}</div></div>
        ${(s.tags || []).length ? `<div class="row"><div class="k">标签</div><div class="v">${s.tags.map(t => `<span class="chip green">${ui.esc(t)}</span>`).join(' ')}</div></div>` : ''}

        <div class="section-title">谱系（向上）</div>
        <div class="tags">
          ${chain.map((c, i) => `<span class="chip ${i === 0 ? 'blue' : ''}">${ui.esc(c.code || c.name)}</span>${i < chain.length - 1 ? ' <span style="color:var(--muted)">←</span> ' : ''}`).join('')}
        </div>

        <div class="section-title">关联实验 (${exps.length})</div>
        ${exps.length ? `<div class="timeline">${exps.map(e => `
          <div class="tl-item" data-eid="${e.id}" style="cursor:pointer">
            <div class="tl-date">${ui.fmtDate(e.date || e.createdAt)}</div>
            <div><b>${ui.esc(e.title || '未命名实验')}</b></div>
            <div class="meta" style="color:var(--ink-soft);font-size:12.5px">${ui.esc((e.purpose || '').slice(0, 80))}</div>
          </div>`).join('')}</div>` : `<div class="empty" style="padding:16px 0">暂无关联实验。</div>`}
      </div>
    `;
    app.innerHTML = html;
    app.querySelector('#back').onclick = () => render(app);
    app.querySelector('#edit').onclick = () => editForm(s);
    app.querySelector('#del').onclick = async () => {
      if (confirm(`确认删除菌株「${s.name || s.code}」？该操作不可撤销。`)) {
        await DB.remove('strains', id); ui.toast('已删除'); render(app);
      }
    };
    app.querySelector('#newExp').onclick = () => window.Views.eln.editForm(null, [id], () => openDetail(app, id));
    app.querySelectorAll('.tl-item').forEach(it => it.onclick = () => window.Views.eln.openDetail(app, it.dataset.eid));
  }

  function editForm(s) {
    s = s || {};
    DB.getAll('strains').then(all => {
      const m = ui.modal(s.id ? '编辑菌株' : '新建菌株');
      const opts = all.filter(x => x.id !== s.id)
        .map(x => `<option value="${x.id}" ${(s.parentId === x.id) ? 'selected' : ''}>${ui.esc(x.code || x.name)}</option>`).join('');
      m.body.innerHTML = `
        <label>菌株编号 *</label><input id="f_code" value="${ui.esc(s.code || '')}" placeholder="如 YS-001 / CEN.PK-derived" />
        <label>名称 *</label><input id="f_name" value="${ui.esc(s.name || '')}" placeholder="如 乳酸高产底盘" />
        <label>基因型 / 编辑位点</label><textarea id="f_genotype" placeholder="如 MATa his3Δ1 leu2Δ0 ura3Δ0 lys2Δ0 YAL062W::pGAL1-tCas9">${ui.esc(s.genotype || '')}</textarea>
        <label>筛选标记</label><input id="f_markers" value="${ui.esc(s.markers || '')}" placeholder="如 URA3 / HIS3 / NAT" />
        <label>构建方法</label><input id="f_method" value="${ui.esc(s.method || '')}" placeholder="如 CRISPR-Cas9 整合 / 传统同源重组" />
        <label>来源</label><input id="f_source" value="${ui.esc(s.source || '')}" placeholder="如 实验室保藏 / 课题组A赠送 / ATCC" />
        <label>亲本菌株</label><select id="f_parent"><option value="">— 无 —</option>${opts}</select>
        <label>保藏位置</label><input id="f_location" value="${ui.esc(s.location || '')}" placeholder="如 甘油管 -80℃ / 菌种盒 B3" />
        <label>标签（逗号分隔）</label><input id="f_tags" value="${ui.esc((s.tags || []).join(', '))}" placeholder="如 底盘, 乳酸, CRISPR" />
        <label>备注</label><textarea id="f_notes">${ui.esc(s.notes || '')}</textarea>
      `;
      const save = m.foot.appendChild(document.createElement('button'));
      save.className = 'btn primary'; save.textContent = '保存';
      const cancel = m.foot.appendChild(document.createElement('button'));
      cancel.className = 'btn'; cancel.textContent = '取消';
      cancel.onclick = m.close;
      save.onclick = async () => {
        const code = m.body.querySelector('#f_code').value.trim();
        const name = m.body.querySelector('#f_name').value.trim();
        if (!code || !name) { alert('编号和名称为必填项'); return; }
        const obj = {
          id: s.id, code, name,
          genotype: m.body.querySelector('#f_genotype').value.trim(),
          markers: m.body.querySelector('#f_markers').value.trim(),
          method: m.body.querySelector('#f_method').value.trim(),
          source: m.body.querySelector('#f_source').value.trim(),
          parentId: m.body.querySelector('#f_parent').value || '',
          location: m.body.querySelector('#f_location').value.trim(),
          tags: m.body.querySelector('#f_tags').value.split(',').map(t => t.trim()).filter(Boolean),
          notes: m.body.querySelector('#f_notes').value.trim()
        };
        await DB.save('strains', obj);
        m.close(); ui.toast('菌株已保存');
        // 刷新当前视图（列表或详情）
        const app = document.getElementById('app');
        if (s.id) openDetail(app, s.id); else render(app);
      };
    });
  }

  Views.strains = { render };
})();
