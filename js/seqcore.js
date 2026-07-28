/*
 * seqcore.js — 纯函数序列工具库
 * 同时支持浏览器(挂到 window.SeqCore) 与 Node(module.exports) 用于单测。
 * 所有计算均为"近似/教学级"，用于实验台日常设计参考，正式下单前请以 NEB 等官方工具复核。
 */
(function (root) {
  'use strict';

  const COMP = { A: 'T', T: 'A', G: 'C', C: 'G', U: 'A', N: 'N',
                 a: 't', t: 'a', g: 'c', c: 'g', u: 'a', n: 'n' };

  function clean(seq) {
    return (seq || '').toUpperCase().replace(/[^ACGTUN]/g, '');
  }

  function reverse(s) {
    return s.split('').reverse().join('');
  }

  function complement(seq) {
    return seq.split('').map(c => COMP[c] || 'N').join('');
  }

  function reverseComplement(seq) {
    return reverse(complement(clean(seq)));
  }

  function gcContent(seq) {
    seq = clean(seq);
    if (!seq.length) return 0;
    let gc = 0;
    for (const c of seq) if (c === 'G' || c === 'C') gc++;
    return (gc / seq.length) * 100;
  }

  // Tm 近似：<14nt 用 Wallace 法则；>=14nt 用盐校正近似(默认 50mM Na+)
  function tm(seq, opts) {
    seq = clean(seq);
    const o = opts || {};
    const na = o.na || 50; // mM
    const len = seq.length;
    if (len === 0) return 0;
    let at = 0, gc = 0;
    for (const c of seq) {
      if (c === 'A' || c === 'T') at++;
      else if (c === 'G' || c === 'C') gc++;
    }
    if (len < 14) {
      return 2 * at + 4 * gc; // Wallace
    }
    // 盐校正近似 (Marmur-Doty 思路 + 单价盐项)
    const saltTerm = 16.6 * Math.log10((na / 1000) + 0.05); // 经验修正
    let t = 81.5 + 0.41 * gcContent(seq) - 675 / len + saltTerm;
    return Math.round(t * 10) / 10;
  }

  // 从一段模板区域自动设计引物：取上游起点正向、下游末端反向互补
  // opts: { fLen, rLen, fTmTarget, rTmTarget } 仅用于提示，不做迭代优化
  function designPrimers(template, opts) {
    const t = clean(template);
    const o = opts || {};
    const fLen = Math.min(o.fLen || 20, t.length);
    const rLen = Math.min(o.rLen || 20, t.length);
    if (t.length < 2) return null;
    const fSeq = t.slice(0, fLen);
    const rSeq = reverseComplement(t.slice(t.length - rLen));
    return {
      forward: describePrimer(fSeq, 'forward'),
      reverse: describePrimer(rSeq, 'reverse')
    };
  }

  function describePrimer(seq, type) {
    return {
      type,
      sequence: seq,
      length: seq.length,
      gc: Math.round(gcContent(seq) * 10) / 10,
      tm: tm(seq),
      any: selfComplementScore(seq),     // 自身二聚体/发夹启发式评分
      warnings: primerWarnings(seq)
    };
  }

  // 自身互补评分：找最长的 3' 端反向互补连续匹配（启发式）
  function selfComplementScore(seq) {
    seq = clean(seq);
    const rc = reverseComplement(seq);
    let best = 0;
    // 检查 3' 端是否能与自身其他位置退火
    for (let i = Math.max(0, seq.length - 8); i < seq.length; i++) {
      const tail = seq.slice(i);
      const idx = rc.indexOf(reverseComplement(tail));
      if (idx !== -1) best = Math.max(best, tail.length);
    }
    return best;
  }

  function primerWarnings(seq) {
    const w = [];
    const gc = gcContent(seq);
    const len = seq.length;
    if (gc < 40) w.push('GC 偏低(<40%)，可能 Tm 过低');
    if (gc > 60) w.push('GC 偏高(>60%)，可能 Tm 过高/易二级结构');
    if (len < 18) w.push('长度偏短(<18nt)');
    if (len > 30) w.push('长度偏长(>30nt)');
    // 末端 GC clamp 检查（最后 5 个碱基 GC 数）
    const tail = seq.slice(-5);
    let tgc = 0; for (const c of tail) if (c === 'G' || c === 'C') tgc++;
    if (tgc === 0) w.push('3\' 端缺乏 GC clamp，可能影响延伸效率');
    if (selfComplementScore(seq) >= 4) w.push('存在明显自身互补(>=4nt)，警惕发夹/二聚体');
    // 连续单一碱基
    if (/(.)\1{4,}/.test(seq)) w.push('存在 >=5 个连续相同碱基');
    return w;
  }

  // Gibson / 同源重组 同源臂设计
  // upstream: 基因组/载体上插入位点上游同源区; insert: 插入片段; downstream: 下游同源区
  // armLen: 每侧同源臂长度
  function gibsonArms(upstream, insert, downstream, armLen) {
    const u = clean(upstream), ins = clean(insert), d = clean(downstream);
    const n = armLen || 20;
    const leftArm = u.slice(Math.max(0, u.length - n)) + ins.slice(0, n);
    const rightArm = ins.slice(Math.max(0, ins.length - n)) + d.slice(0, n);
    return {
      leftArm: describeArm(leftArm),
      rightArm: describeArm(rightArm),
      armLen: n
    };
  }

  function describeArm(seq) {
    return {
      sequence: seq,
      length: seq.length,
      gc: Math.round(gcContent(seq) * 10) / 10,
      tm: tm(seq)
    };
  }

  // 给定两个要拼接的片段，检查/返回重叠区（取片段A的3'端与片段B的5'端）
  function overlapRegion(fragA, fragB, minOverlap) {
    const a = clean(fragA), b = clean(fragB);
    const min = minOverlap || 15;
    // 在 a 的尾部与 b 的头部寻找最长公共子串
    let best = { len: 0, aStart: 0, bStart: 0 };
    for (let i = Math.max(0, a.length - 60); i < a.length; i++) {
      const sub = a.slice(i);
      const idx = b.indexOf(sub.slice(0, Math.min(sub.length, 60)));
      if (idx === 0) {
        // 公共前缀长度
        let L = 0; while (L < sub.length && b[L] === sub[L]) L++;
        if (L > best.len) best = { len: L, aStart: i, bStart: 0 };
      }
    }
    if (best.len < min) return { found: false, min };
    const ov = a.slice(best.aStart, best.aStart + best.len);
    return {
      found: true, min,
      overlap: describeArm(ov),
      aStart: best.aStart, bStart: best.bStart,
      note: '重叠区位于片段A第' + best.aStart + '位起 / 片段B第' + best.bStart + '位起'
    };
  }

  // 常用内切酶表：site 为识别序列，cut 为 5'->3' 方向切割位点(0-based, 在 site 内)
  // iis=true 表示 IIs 型(切割位于识别序列外侧)。overhang 由 site长度与cut推导。
  const ENZYMES = [
    { name: 'EcoRI',  site: 'GAATTC',  cut: 1 },
    { name: 'BamHI',  site: 'GGATCC',  cut: 1 },
    { name: 'HindIII',site: 'AAGCTT',  cut: 1 },
    { name: 'XhoI',   site: 'CTCGAG',  cut: 1 },
    { name: 'SacI',   site: 'GAGCTC',  cut: 5 },
    { name: 'SpeI',   site: 'ACTAGT',  cut: 1 },
    { name: 'XbaI',   site: 'TCTAGA',  cut: 1 },
    { name: 'NheI',   site: 'GCTAGC',  cut: 1 },
    { name: 'KpnI',   site: 'GGTACC',  cut: 5 },
    { name: 'SalI',   site: 'GTCGAC',  cut: 1 },
    { name: 'PstI',   site: 'CTGCAG',  cut: 4 },
    { name: 'NotI',   site: 'GCGGCCGC',cut: 2 },
    { name: 'SmaI',   site: 'CCCGGG',  cut: 3 },
    { name: 'EcoRV',  site: 'GATATC',  cut: 3 },
    { name: 'BglII',  site: 'AGATCT',  cut: 1 },
    { name: 'AgeI',   site: 'ACCGGT',  cut: 2 },
    { name: 'NcoI',   site: 'CCATGG',  cut: 2 },
    { name: 'NdeI',   site: 'CATATG',  cut: 2 },
    { name: 'PacI',   site: 'TTAATTAA',cut: 3 },
    { name: 'AscI',   site: 'GGCGCGCC',cut: 3 },
    { name: 'BsaI',   site: 'GGTCTC',  cut: 6, iis: true, ov: 4 },
    { name: 'BsmBI',  site: 'CGTCTC',  cut: 6, iis: true, ov: 4 }
  ];

  function enzymeByName(name) {
    return ENZYMES.find(e => e.name.toLowerCase() === String(name).toLowerCase());
  }

  // 在序列中查找某酶切位点（含其反向互补，因双链）
  // 回文位点只报正链；非回文按切割位置去重，避免同一物理位点被计数两次
  function findSites(seq, enzymeName) {
    const s = clean(seq);
    const e = enzymeByName(enzymeName);
    if (!e) return [];
    const site = e.site;
    const rcSite = reverseComplement(site);
    const palindromic = site === rcSite;
    const hits = [];
    let i = s.indexOf(site);
    while (i !== -1) {
      hits.push({ pos: i + 1, strand: '+', site, cut: i + e.cut });
      i = s.indexOf(site, i + 1);
    }
    if (!palindromic) {
      let j = s.indexOf(rcSite);
      while (j !== -1) {
        hits.push({ pos: j + 1, strand: '-', site: rcSite, cut: j + (rcSite.length - e.cut) });
        j = s.indexOf(rcSite, j + 1);
      }
    }
    // 按切割位置去重（双链同一物理位点）
    const seen = new Set();
    const uniq = hits.filter(h => {
      if (seen.has(h.cut)) return false;
      seen.add(h.cut);
      return true;
    });
    uniq.sort((a, b) => a.pos - b.pos);
    uniq.forEach(h => { h.enzyme = e.name; h.overhang = e.iis ? e.ov : (site.length - 2 * e.cut); });
    return uniq;
  }

  // 扫描多个酶，返回 {enzyme, hits, unique}
  function scanRestriction(seq, enzymeNames) {
    return enzymeNames.map(name => {
      const hits = findSites(seq, name);
      return { enzyme: name, hits, unique: hits.length === 1, count: hits.length };
    }).filter(r => r.count > 0);
  }

  // 测序验证：在模板中定位引物结合位置
  function locatePrimer(template, primer) {
    const t = clean(template), p = clean(primer);
    if (!p) return [];
    const rc = reverseComplement(p);
    const res = [];
    let i = t.indexOf(p);
    while (i !== -1) { res.push({ pos: i + 1, strand: '+', end: i + p.length }); i = t.indexOf(p, i + 1); }
    let j = t.indexOf(rc);
    while (j !== -1) { res.push({ pos: j + 1, strand: '- (rc)', end: j + rc.length }); j = t.indexOf(rc, j + 1); }
    return res;
  }

  function stats(seq) {
    seq = clean(seq);
    return {
      length: seq.length,
      gc: Math.round(gcContent(seq) * 10) / 10,
      a: (seq.match(/A/g) || []).length,
      t: (seq.match(/T/g) || []).length,
      g: (seq.match(/G/g) || []).length,
      c: (seq.match(/C/g) || []).length,
      n: (seq.match(/N/g) || []).length
    };
  }

  const SeqCore = {
    clean, reverse, complement, reverseComplement, gcContent, tm,
    designPrimers, selfComplementScore, primerWarnings,
    gibsonArms, overlapRegion, enzymeByName, findSites, scanRestriction,
    locatePrimer, stats, ENZYMES
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = SeqCore;
  root.SeqCore = SeqCore;
})(typeof window !== 'undefined' ? window : globalThis);
