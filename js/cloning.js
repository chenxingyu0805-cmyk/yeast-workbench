/* cloning.js — 克隆 & 引物工具模块 */
(function () {
  'use strict';
  const Views = (window.Views = window.Views || {});
  const S = window.SeqCore, ui = window.YW.ui;

  function render(app) {
    app.innerHTML = `
      <div class="view-head">
        <div><h2>克隆 &amp; 引物工具</h2><div class="sub">引物设计 / Tm · Gibson 同源臂 · 酶切位点 · 测序验证（计算为近似参考）</div></div>
      </div>
      <div class="tabs" id="tabs">
        <button class="tab active" data-t="primer">引物设计 / 计算</button>
        <button class="tab" data-t="gibson">Gibson 同源臂</button>
        <button class="tab" data-t="re">酶切位点分析</button>
        <button class="tab" data-t="seq">测序验证</button>
        <button class="tab" data-t="stat">序列统计</button>
      </div>
      <div id="toolBody"></div>
    `;
    const tabs = app.querySelector('#tabs');
    tabs.onclick = e => {
      if (!e.target.classList.contains('tab')) return;
      tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      drawTool(app.querySelector('#toolBody'), e.target.dataset.t);
    };
    drawTool(app.querySelector('#toolBody'), 'primer');
  }

  function drawTool(body, t) {
    if (t === 'primer') return primerTool(body);
    if (t === 'gibson') return gibsonTool(body);
    if (t === 're') return reTool(body);
    if (t === 'seq') return seqTool(body);
    if (t === 'stat') return statTool(body);
  }

  /* ---- 引物设计 / 计算 ---- */
  function primerTool(body) {
    body.innerHTML = `
      <div class="two-col">
        <div>
          <div class="section-title">① 引物自动设计</div>
          <label>模板 / 目标区域序列</label>
          <textarea id="p_tmpl" placeholder="粘贴一段 DNA 序列，自动取 5' 端正向、3' 端反向互补作为引物"></textarea>
          <div class="two-col" style="gap:10px">
            <div><label>上游长度</label><input id="p_fl" type="number" value="20" /></div>
            <div><label>下游长度</label><input id="p_rl" type="number" value="20" /></div>
          </div>
          <button class="btn primary" id="p_design" style="margin-top:8px">设计引物</button>
          <div id="p_out"></div>
        </div>
        <div>
          <div class="section-title">② 单引物分析 / Tm 计算</div>
          <label>引物序列</label>
          <textarea id="p_one" placeholder="粘贴单条引物"></textarea>
          <label>Na+ 浓度 (mM)</label><input id="p_na" type="number" value="50" />
          <button class="btn accent" id="p_calc" style="margin-top:8px">计算</button>
          <div id="p_one_out"></div>
          <div class="section-title">③ 反向互补 / 互补转换</div>
          <label>序列</label><textarea id="p_rc" placeholder="任意序列"></textarea>
          <button class="btn" id="p_rcbtn" style="margin-top:8px">转换</button>
          <div id="p_rc_out"></div>
        </div>
      </div>
    `;
    body.querySelector('#p_design').onclick = () => {
      const tmpl = body.querySelector('#p_tmpl').value;
      const fl = +body.querySelector('#p_fl').value || 20;
      const rl = +body.querySelector('#p_rl').value || 20;
      const out = body.querySelector('#p_out');
      if (!S.clean(tmpl)) { out.innerHTML = `<div class="result">请输入模板序列。</div>`; return; }
      const r = S.designPrimers(tmpl, { fLen: fl, rLen: rl });
      if (!r) { out.innerHTML = `<div class="result">序列过短。</div>`; return; }
      out.innerHTML = primerCard('上游引物 (Forward)', r.forward) + primerCard('下游引物 (Reverse)', r.reverse);
    };
    body.querySelector('#p_calc').onclick = () => {
      const seq = body.querySelector('#p_one').value;
      const na = +body.querySelector('#p_na').value || 50;
      const out = body.querySelector('#p_one_out');
      if (!S.clean(seq)) { out.innerHTML = `<div class="result">请输入引物序列。</div>`; return; }
      const d = S.describePrimer(seq, 'primer');
      d.tm = S.tm(seq, { na });
      out.innerHTML = primerCard('分析结果', d);
    };
    body.querySelector('#p_rcbtn').onclick = () => {
      const seq = body.querySelector('#p_rc').value;
      const out = body.querySelector('#p_rc_out');
      if (!S.clean(seq)) { out.innerHTML = `<div class="result">请输入序列。</div>`; return; }
      out.innerHTML = `
        <div class="kv" style="margin-top:8px">
          <div class="k">反向互补</div><div class="v mono">${S.reverseComplement(seq)}</div>
          <div class="k">互补</div><div class="v mono">${S.complement(seq)}</div>
        </div>`;
    };
  }

  function primerCard(title, d) {
    const w = d.warnings && d.warnings.length
      ? `<div class="warn-list" style="margin-top:6px">⚠ ${d.warnings.map(x => `<div>• ${x}</div>`).join('')}</div>` : `<div class="ok" style="margin-top:6px">✓ 无明显问题</div>`;
    return `
      <div class="detail" style="margin-top:10px;box-shadow:none">
        <b>${title}</b>
        <div class="seqbox" style="margin:6px 0">${d.sequence}</div>
        <div class="kv">
          <div class="k">长度</div><div class="v">${d.length} nt</div>
          <div class="k">Tm (近似)</div><div class="v">${d.tm} °C</div>
          <div class="k">GC 含量</div><div class="v">${d.gc} %</div>
          <div class="k">自身互补</div><div class="v">${d.any} nt</div>
        </div>
        ${w}
      </div>`;
  }

  /* ---- Gibson 同源臂 ---- */
  function gibsonTool(body) {
    body.innerHTML = `
      <div class="section-title">同源重组 / Gibson 同源臂设计</div>
      <div class="two-col">
        <div>
          <label>上游同源区（基因组/载体，插入位点上游）</label>
          <textarea id="g_up" placeholder="如染色体靶位点上游 ~60bp"></textarea>
          <label>插入片段</label>
          <textarea id="g_ins" placeholder="要整合的片段（含表达盒等）"></textarea>
          <label>下游同源区（插入位点下游）</label>
          <textarea id="g_down" placeholder="如染色体靶位点下游 ~60bp"></textarea>
          <label>同源臂长度 (bp)</label><input id="g_n" type="number" value="20" />
          <button class="btn primary" id="g_run" style="margin-top:8px">计算同源臂</button>
        </div>
        <div id="g_out"></div>
      </div>
      <div class="hint">说明：左臂 = 上游尾部 + 插入片段头部；右臂 = 插入片段尾部 + 下游头部。酵母整合一般建议同源臂 40–60bp（更长整合效率更高），每侧 Tm 越高越利于同源重组。</div>
    `;
    body.querySelector('#g_run').onclick = () => {
      const up = body.querySelector('#g_up').value, ins = body.querySelector('#g_ins').value, down = body.querySelector('#g_down').value;
      const n = +body.querySelector('#g_n').value || 20;
      const out = body.querySelector('#g_out');
      if (!S.clean(up) || !S.clean(ins) || !S.clean(down)) { out.innerHTML = `<div class="result">请填写三段序列。</div>`; return; }
      const r = S.gibsonArms(up, ins, down, n);
      out.innerHTML = armCard('左同源臂 (Left)', r.leftArm) + armCard('右同源臂 (Right)', r.rightArm);
    };
  }

  function armCard(title, a) {
    return `
      <div class="detail" style="margin-top:10px;box-shadow:none">
        <b>${title}</b>
        <div class="seqbox" style="margin:6px 0">${a.sequence}</div>
        <div class="kv">
          <div class="k">长度</div><div class="v">${a.length} bp</div>
          <div class="k">GC 含量</div><div class="v">${a.gc} %</div>
          <div class="k">Tm (近似)</div><div class="v">${a.tm} °C</div>
        </div>
      </div>`;
  }

  /* ---- 酶切位点分析 ---- */
  function reTool(body) {
    const ens = S.ENZYMES.map(e => `<label style="display:inline-flex;gap:5px;margin:4px 10px 4px 0;font-weight:400"><input type="checkbox" value="${e.name}" ${['EcoRI','BamHI','XhoI','HindIII','NotI','SacI','KpnI','SalI'].includes(e.name) ? 'checked' : ''}/> ${e.name} <span class="pill">${e.site}</span></label>`).join('');
    body.innerHTML = `
      <div class="section-title">内切酶位点扫描</div>
      <label>待分析序列（质粒 / 片段）</label>
      <textarea id="r_seq" placeholder="粘贴序列，扫描所选酶切位点"></textarea>
      <div style="margin:10px 0"><b style="font-size:13px">选择酶：</b><br/>${ens}</div>
      <button class="btn primary" id="r_run">扫描</button>
      <div id="r_out"></div>
    `;
    body.querySelector('#r_run').onclick = () => {
      const seq = body.querySelector('#r_seq').value;
      const out = body.querySelector('#r_out');
      const picked = [...body.querySelectorAll('input[type=checkbox]:checked')].map(c => c.value);
      if (!S.clean(seq)) { out.innerHTML = `<div class="result">请输入序列。</div>`; return; }
      const res = S.scanRestriction(seq, picked);
      if (!res.length) { out.innerHTML = `<div class="result">所选酶在序列中均未发现位点。</div>`; return; }
      out.innerHTML = `
        <table style="margin-top:12px">
          <thead><tr><th>酶</th><th>识别位点</th><th>出现次数</th><th>位置 (5'起)</th><th>突出端</th><th>唯一?</th></tr></thead>
          <tbody>${res.map(r => `
            <tr>
              <td><b>${r.enzyme}</b></td>
              <td class="mono">${r.hits[0].site}</td>
              <td>${r.count}</td>
              <td class="mono">${r.hits.map(h => h.pos + (h.strand === '-' ? '(-)' : '')).join(', ')}</td>
              <td>${r.hits[0].overhang === 0 ? '平末端' : (r.hits[0].overhang > 0 ? r.hits[0].overhang + 'nt 5′突出' : (-r.hits[0].overhang) + 'nt 3′突出')}</td>
              <td class="${r.unique ? 'ok' : 'bad'}">${r.unique ? '✓ 唯一' : '✗ 非唯一'}</td>
            </tr>`).join('')}</tbody>
        </table>`;
    };
  }

  /* ---- 测序验证 ---- */
  function seqTool(body) {
    body.innerHTML = `
      <div class="section-title">测序验证：定位引物结合位置</div>
      <label>模板序列（质粒 / 片段）</label>
      <textarea id="s_tmpl" placeholder="粘贴模板序列"></textarea>
      <label>测序引物</label>
      <textarea id="s_primer" placeholder="粘贴引物序列（正向或反向均可）"></textarea>
      <button class="btn primary" id="s_run" style="margin-top:8px">定位</button>
      <div id="s_out"></div>
    `;
    body.querySelector('#s_run').onclick = () => {
      const tmpl = body.querySelector('#s_tmpl').value, primer = body.querySelector('#s_primer').value;
      const out = body.querySelector('#s_out');
      if (!S.clean(tmpl) || !S.clean(primer)) { out.innerHTML = `<div class="result">请填写模板与引物。</div>`; return; }
      const hits = S.locatePrimer(tmpl, primer);
      if (!hits.length) { out.innerHTML = `<div class="result">未找到该引物结合位点。</div>`; return; }
      out.innerHTML = `<div class="result">找到 ${hits.length} 处结合：\n` +
        hits.map(h => `位置 ${h.pos}–${h.end} (${h.strand})`).join('\n') + `</div>`;
    };
  }

  /* ---- 序列统计 ---- */
  function statTool(body) {
    body.innerHTML = `
      <div class="section-title">序列基本统计</div>
      <label>序列</label>
      <textarea id="st_seq" placeholder="粘贴 DNA 序列"></textarea>
      <button class="btn primary" id="st_run" style="margin-top:8px">统计</button>
      <div id="st_out"></div>
    `;
    body.querySelector('#st_run').onclick = () => {
      const seq = body.querySelector('#st_seq').value;
      const out = body.querySelector('#st_out');
      if (!S.clean(seq)) { out.innerHTML = `<div class="result">请输入序列。</div>`; return; }
      const s = S.stats(seq);
      out.innerHTML = `
        <div class="kv" style="margin-top:10px">
          <div class="k">长度</div><div class="v">${s.length} nt</div>
          <div class="k">GC 含量</div><div class="v">${s.gc} %</div>
          <div class="k">A / T</div><div class="v">${s.a} / ${s.t}</div>
          <div class="k">G / C</div><div class="v">${s.g} / ${s.c}</div>
          <div class="k">未知 N</div><div class="v">${s.n}</div>
        </div>`;
    };
  }

  Views.cloning = { render };
})();
