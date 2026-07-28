/* eln.js — 实验记录 (Electronic Lab Notebook) 模块 */
(function () {
  'use strict';
  const Views = (window.Views = window.Views || {});
  const DB = window.YWDB, ui = window.YW.ui;

  let state = { list: [], search: '', tag: '' };

  async function load() {
    state.list = (await DB.getAll('experiments'))
      .sort((a, b) => (b.date || b.createdAt || '').localeCompare(a.date || a.createdAt || ''));
  }

  function allTags() {
    const set = new Set();
    state.list.forEach(e => (e.tags || []).forEach(t => set.add(t)));
    return [...set].sort();
  }

  function filtered() {
    const q = state.search.trim().toLowerCase();
    return state.list.filter(e => {
      if (state.tag && !(e.tags || []).includes(state.tag)) return false;
      if (!q) return true;
      const hay = [e.title, e.purpose, e.protocol, e.results, e.conclusion, (e.tags || []).join(' ')].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function render(app) {
    load().then(() => {
      const items = filtered();
      const tags = allTags();
      app.innerHTML = `
        <div class="view-head">
          <div><h2>实验记录 ELN</h2><div class="sub">沉淀每一次转化、筛选、验证与复盘</div></div>
          <button class="btn primary" id="newExp">+ 新建实验</button>
        </div>
        <div class="toolbar">
          <input id="search" placeholder="搜索标题 / 目的 / 结果 / 结论…" value="${ui.esc(state.search)}" style="max-width:340px" />
          <select id="tagFilter" style="max-width:180px">
            <option value="">全部标签</option>
            ${tags.map(t => `<option value="${ui.esc(t)}" ${state.tag === t ? 'selected' : ''}>${ui.esc(t)}</option>`).join('')}
          </select>
          <span class="pill">${items.length} / ${state.list.length} 条</span>
        </div>
        ${items.length ? `<div class="timeline">${items.map(tlItem).join('')}</div>` : `<div class="empty">还没有实验记录，点右上角「新建实验」开始。</div>`}
      `;
      app.querySelector('#newExp').onclick = () => editForm(null, [], () => render(app));
      app.querySelector('#search').oninput = e => { state.search = e.target.value; rerender(app); };
      app.querySelector('#tagFilter').onchange = e => { state.tag = e.target.value; rerender(app); };
      app.querySelectorAll('.tl-item').forEach(it => it.onclick = () => openDetail(app, it.dataset.id));
    });
  }

  function rerender(app) {
    const items = filtered();
    const tags = allTags();
    const wrap = document.createElement('div');
    wrap.innerHTML = `
        <div class="toolbar">
          <input id="search" placeholder="搜索标题 / 目的 / 结果 / 结论…" value="${ui.esc(state.search)}" style="max-width:340px" />
          <select id="tagFilter" style="max-width:180px">
            <option value="">全部标签</option>
            ${tags.map(t => `<option value="${ui.esc(t)}" ${state.tag === t ? 'selected' : ''}>${ui.esc(t)}</option>`).join('')}
          </select>
          <span class="pill">${items.length} / ${state.list.length} 条</span>
        </div>
        ${items.length ? `<div class="timeline">${items.map(tlItem).join('')}</div>` : `<div class="empty">没有匹配的实验。</div>`}
    `;
    const head = app.querySelector('.view-head');
    app.innerHTML = ''; app.appendChild(head);
    while (wrap.firstChild) app.appendChild(wrap.firstChild);
    app.querySelector('#search').oninput = e => { state.search = e.target.value; rerender(app); };
    app.querySelector('#tagFilter').onchange = e => { state.tag = e.target.value; rerender(app); };
    app.querySelector('#newExp').onclick = () => editForm(null, [], () => render(app));
    app.querySelectorAll('.tl-item').forEach(it => it.onclick = () => openDetail(app, it.dataset.id));
  }

  function tlItem(e) {
    return `
      <div class="tl-item" data-id="${e.id}" style="cursor:pointer">
        <div class="tl-date">${ui.fmtDate(e.date || e.createdAt)}</div>
        <div><b>${ui.esc(e.title || '未命名实验')}</b></div>
        <div class="meta" style="color:var(--ink-soft);font-size:12.5px">${ui.esc((e.purpose || '').slice(0, 90))}</div>
        ${(e.tags || []).length ? `<div class="tags">${e.tags.map(t => `<span class="chip">${ui.esc(t)}</span>`).join('')}</div>` : ''}
      </div>`;
  }

  async function openDetail(app, id) {
    const e = await DB.get('experiments', id);
    if (!e) return;
    const strains = await DB.getAll('strains');
    const linked = (e.strainIds || []).map(sid => strains.find(s => s.id === sid)).filter(Boolean);
    app.innerHTML = `
      <div class="view-head">
        <div><h2>${ui.esc(e.title || '未命名实验')}</h2><div class="sub">${ui.fmtDate(e.date || e.createdAt)}</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn" id="back">← 返回</button>
          <button class="btn" id="edit">编辑</button>
          <button class="btn danger" id="del">删除</button>
        </div>
      </div>
      <div class="detail">
        <div class="row"><div class="k">日期</div><div class="v">${ui.fmtDate(e.date || e.createdAt)}</div></div>
        <div class="row"><div class="k">关联菌株</div><div class="v">${linked.length ? linked.map(s => `<span class="chip green">${ui.esc(s.code || s.name)}</span>`).join(' ') : '—'}</div></div>
        <div class="row"><div class="k">目的</div><div class="v">${ui.esc(e.purpose || '—')}</div></div>
        <div class="row"><div class="k">方案 / 步骤</div><div class="v" style="white-space:pre-wrap">${ui.esc(e.protocol || '—')}</div></div>
        <div class="row"><div class="k">试剂与条件</div><div class="v" style="white-space:pre-wrap">${ui.esc(e.reagents || '—')}</div></div>
        <div class="row"><div class="k">结果 / 观察</div><div class="v" style="white-space:pre-wrap">${ui.esc(e.results || '—')}</div></div>
        <div class="row"><div class="k">结论 / 复盘</div><div class="v" style="white-space:pre-wrap">${ui.esc(e.conclusion || '—')}</div></div>
        ${(e.tags || []).length ? `<div class="row"><div class="k">标签</div><div class="v">${e.tags.map(t => `<span class="chip">${ui.esc(t)}</span>`).join(' ')}</div></div>` : ''}
        <div class="row"><div class="k">创建 / 更新</div><div class="v">${ui.fmtDate(e.createdAt)} / ${ui.fmtDate(e.updatedAt)}</div></div>
      </div>
    `;
    app.querySelector('#back').onclick = () => render(app);
    app.querySelector('#edit').onclick = () => editForm(e, e.strainIds || [], () => openDetail(app, id));
    app.querySelector('#del').onclick = async () => {
      if (confirm(`确认删除实验「${e.title || '未命名'}」？`)) { await DB.remove('experiments', id); ui.toast('已删除'); render(app); }
    };
  }

  // presetStrainIds: 预选菌株；afterSave: 保存后回调
  function editForm(e, presetStrainIds, afterSave) {
    e = e || {};
    Promise.all([DB.getAll('strains')]).then(([strains]) => {
      const m = ui.modal(e.id ? '编辑实验' : '新建实验');
      const selStrains = (e.strainIds || presetStrainIds || []);
      const opts = strains.map(s => `<option value="${s.id}" ${selStrains.includes(s.id) ? 'selected' : ''}>${ui.esc(s.code || s.name)}</option>`).join('');
      m.body.innerHTML = `
        <label>实验标题 *</label><input id="f_title" value="${ui.esc(e.title || '')}" placeholder="如 YS-001 启动子替换验证" />
        <label>日期</label><input id="f_date" type="date" value="${ui.esc((e.date || '').slice(0, 10))}" />
        <label>关联菌株（可多选）</label><select id="f_strains" multiple size="4">${opts || '<option disabled>暂无菌株，请先在菌株库新建</option>'}</select>
        <label>目的</label><textarea id="f_purpose" placeholder="想验证/达成的目标">${ui.esc(e.purpose || '')}</textarea>
        <label>方案 / 步骤</label><textarea id="f_protocol" placeholder="引物、酶、程序、培养条件…">${ui.esc(e.protocol || '')}</textarea>
        <label>试剂与条件</label><textarea id="f_reagents" placeholder="体系组成、浓度、温度、时间">${ui.esc(e.reagents || '')}</textarea>
        <label>结果 / 观察</label><textarea id="f_results" placeholder="菌落数、OD、平板/测序结果…">${ui.esc(e.results || '')}</textarea>
        <label>结论 / 复盘</label><textarea id="f_conclusion" placeholder="是否达成、下一步">${ui.esc(e.conclusion || '')}</textarea>
        <label>标签（逗号分隔）</label><input id="f_tags" value="${ui.esc((e.tags || []).join(', '))}" placeholder="如 转化, 验证, 失败" />
      `;
      const save = m.foot.appendChild(document.createElement('button'));
      save.className = 'btn primary'; save.textContent = '保存';
      const cancel = m.foot.appendChild(document.createElement('button'));
      cancel.className = 'btn'; cancel.textContent = '取消';
      cancel.onclick = m.close;
      save.onclick = async () => {
        const title = m.body.querySelector('#f_title').value.trim();
        if (!title) { alert('实验标题为必填项'); return; }
        const sel = m.body.querySelector('#f_strains');
        const strainIds = sel ? [...sel.selectedOptions].map(o => o.value) : [];
        const obj = {
          id: e.id, title,
          date: m.body.querySelector('#f_date').value || new Date().toISOString().slice(0, 10),
          strainIds,
          purpose: m.body.querySelector('#f_purpose').value.trim(),
          protocol: m.body.querySelector('#f_protocol').value.trim(),
          reagents: m.body.querySelector('#f_reagents').value.trim(),
          results: m.body.querySelector('#f_results').value.trim(),
          conclusion: m.body.querySelector('#f_conclusion').value.trim(),
          tags: m.body.querySelector('#f_tags').value.split(',').map(t => t.trim()).filter(Boolean)
        };
        await DB.save('experiments', obj);
        m.close(); ui.toast('实验已保存'); if (afterSave) afterSave();
      };
    });
  }

  Views.eln = { render, openDetail, editForm };
})();
