/* 油站价哨 · 加油站优惠价格智能监控平台（演示版）
 *
 * 业务模型：
 *   平台（哈啰出行 / 高德地图 / 百度地图 / 滴滴出行）= 合作渠道
 *   服务商（我方「油惠通」与竞品「小吉加油」「省油宝」等）= 在平台上提供加油优惠券的商家
 *   监控目标：同一加油站、同一平台上，各服务商的优惠价与排名
 *
 * 「油惠通」为演示占位品牌，可在设置页修改我方服务商名称。
 */

const KEY = 'oil_sentry_v4';
const DEFAULT_PLATFORMS = ['哈啰出行', '高德地图', '百度地图', '滴滴出行'];
const DEFAULT_MERCHANTS = ['油惠通', '小吉加油', '省油宝', '惠行加油', '满油宝'];
const DEFAULT_PRODUCTS = ['92#', '95#', '98#'];
const COST = { '92#': 6.45, '95#': 6.95, '98#': 7.75 };

/* 各服务商在不同平台投放的优惠力度差异（负值表示让价更多） */
const MERCHANT_OFFSET = {
  '小吉加油': { '哈啰出行': 0.05, '高德地图': 0.03, '百度地图': 0.09, '滴滴出行': 0.04 },
  '省油宝': { '哈啰出行': 0.11, '高德地图': 0.12, '百度地图': 0.08, '滴滴出行': 0.10 },
  '惠行加油': { '哈啰出行': 0.08, '高德地图': 0.06, '百度地图': 0.05, '滴滴出行': 0.09 },
  '满油宝': { '哈啰出行': 0.02, '高德地图': 0.04, '百度地图': 0.06, '滴滴出行': 0.01 }
};

const SEED_STATIONS = [
  { name: '中石化深南大道站', brand: '中石化', area: '福田区', address: '深南大道1006号', p92: 7.22 },
  { name: '中石油皇岗口岸站', brand: '中石油', area: '福田区', address: '皇岗路5001号', p92: 7.16 },
  { name: '中海油梅林加油站', brand: '中海油', area: '福田区', address: '梅林路12号', p92: 7.06, status: '暂停合作' },
  { name: '中石化笋岗加油站', brand: '中石化', area: '罗湖区', address: '宝岗路1号', p92: 7.26 },
  { name: '中石油南头加油站', brand: '中石油', area: '南山区', address: '南头古城路8号', p92: 7.12 },
  { name: '中石化布吉加油站', brand: '中石化', area: '龙岗区', address: '布吉街道吉华路', p92: 7.19 },
  { name: '中海油龙华加油站', brand: '中海油', area: '龙华区', address: '观澜大道48号', p92: 7.02 },
  { name: '中石油宝安加油站', brand: '中石油', area: '宝安区', address: '宝安大道1168号', p92: 7.09 }
];

/* ---------------- 工具函数 ---------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const money = n => Number(n).toFixed(2);
const pct = n => (n * 100).toFixed(0) + '%';
const ourName = () => state.merchants[0];
const ourLabel = () => esc(state.merchants[0]) + '（我方）';

function todayStr() { return dateStr(new Date()); }
function dateStr(d) {
  const p = v => String(v).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
function dayAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}
function shortDate(s) {
  const parts = s.split('-');
  return parts[1] + '/' + parts[2];
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function uid(prefix) {
  return prefix + '_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

let toastTimer = null;
function toast(msg, type) {
  const el = $('#toast');
  el.textContent = msg;
  el.style.background = type === 'error' ? '#B42318' : (type === 'ok' ? '#065F46' : '#0F172A');
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- 演示数据生成 ---------------- */
function genSeed() {
  const stations = SEED_STATIONS.map((s, i) => ({
    id: 'S' + (i + 1),
    name: s.name,
    brand: s.brand,
    area: s.area,
    address: s.address,
    status: s.status || '合作中'
  }));
  const base92 = {};
  SEED_STATIONS.forEach((s, i) => { base92['S' + (i + 1)] = s.p92; });

  const merchants = DEFAULT_MERCHANTS.slice();
  const our = merchants[0];
  const productPrem = { '92#': 0, '95#': 0.5, '98#': 0.95 };
  const records = [];
  const days = 7;

  stations.forEach(st => {
    DEFAULT_PRODUCTS.forEach(prod => {
      DEFAULT_PLATFORMS.forEach(plat => {
        for (let d = days - 1; d >= 0; d--) {
          const date = dayAgo(d);
          const base = base92[st.id] + productPrem[prod];
          // 同站同油品的公共日波动
          const wave = Math.sin((hash(st.id + prod) + d * 7) / 13) * 0.03;

          merchants.forEach(m => {
            let price = base + wave;
            if (m !== our) {
              price += (MERCHANT_OFFSET[m] && MERCHANT_OFFSET[m][plat]) || 0;
              // 各服务商自身的日波动，制造排名变化
              price += Math.sin((hash(st.id + prod + plat + m) + d * 9) / 11) * 0.05;
            } else {
              price += 0.01;
            }
            // 制造两处竞品单日突降，用于演示突变监测
            if (d === 0 && m === '小吉加油' &&
              ((st.id === 'S1' && plat === '高德地图') || (st.id === 'S4' && plat === '滴滴出行'))) {
              price -= 0.16;
            }
            records.push({
              id: uid('R'),
              stationId: st.id,
              product: prod,
              platform: plat,
              merchant: m,
              date,
              price: Math.round(price * 100) / 100,
              source: '演示数据'
            });
          });
        }
      });
    });
  });

  return {
    stations,
    platforms: DEFAULT_PLATFORMS.slice(),
    merchants,
    products: DEFAULT_PRODUCTS.slice(),
    records,
    logs: [],
    settings: { threshold: 0.08, surge: 0.1, operator: '运营专员' }
  };
}

/* 简单字符串哈希，保证演示数据每次生成一致 */
function hash(str) {
  let seed = 0;
  for (let k = 0; k < str.length; k++) seed = (seed * 31 + str.charCodeAt(k)) % 100000;
  return seed;
}

/* ---------------- 状态与持久化 ---------------- */
let state = loadState();
let trendChart = null;

function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj.stations && obj.records && obj.merchants) {
        obj.logs = obj.logs || [];
        obj.settings = obj.settings || {};
        if (typeof obj.settings.threshold !== 'number') obj.settings.threshold = 0.08;
        if (typeof obj.settings.surge !== 'number') obj.settings.surge = 0.1;
        if (!obj.settings.operator) obj.settings.operator = '运营专员';

        // 演示数据跨天后自动重新生成，保证「今日」始终有数据
        const allDemo = obj.records.every(r => r.source === '演示数据');
        const latest = obj.records.reduce((m, r) => (r.date > m ? r.date : m), '');
        if (allDemo && latest !== todayStr()) {
          const fresh = genSeed();
          fresh.settings.operator = obj.settings.operator;
          localStorage.setItem(KEY, JSON.stringify(fresh));
          return fresh;
        }
        return obj;
      }
    }
  } catch (e) { console.warn('读取本地数据失败', e); }
  const seed = genSeed();
  try { localStorage.setItem(KEY, JSON.stringify(seed)); } catch (e) {}
  return seed;
}
function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    toast('本地存储空间不足，保存失败', 'error');
  }
}

/* ---------------- 价格计算 ---------------- */
/* 每个「加油站 + 油品 + 平台 + 服务商」取最新一条记录 */
function latestPrices() {
  const map = {};
  state.records.forEach(r => {
    const k = [r.stationId, r.product, r.platform, r.merchant].join('|');
    const cur = map[k];
    if (!cur || r.date > cur.date) map[k] = r;
  });
  return map;
}

/* 指定平台 + 油品下，按加油站汇总各服务商价格 */
function priceRows(product, platform) {
  const lp = latestPrices();
  const me = ourName();
  const rows = [];
  state.stations.forEach(st => {
    const cells = {};
    let maxDate = '';
    state.merchants.forEach(m => {
      const r = lp[[st.id, product, platform, m].join('|')];
      if (r) {
        cells[m] = r;
        if (r.date > maxDate) maxDate = r.date;
      }
    });
    const names = Object.keys(cells);
    if (!names.length) return;

    const our = cells[me] || null;
    let min = Infinity, minM = '';
    names.forEach(m => {
      if (m === me) return;
      if (cells[m].price < min) { min = cells[m].price; minM = m; }
    });
    if (!isFinite(min)) {
      min = our ? our.price : NaN;
      minM = me;
    }
    rows.push({
      station: st,
      cells,
      our,
      min: Math.round(min * 100) / 100,
      minM,
      maxDate,
      gap: our ? Math.round((our.price - min) * 100) / 100 : null
    });
  });
  return rows;
}

/* 预警：同一平台上，我方价格高于竞品最低价且超过阈值 */
function buildAlerts() {
  const list = [];
  state.platforms.forEach(plat => {
    state.products.forEach(prod => {
      priceRows(prod, plat).forEach(row => {
        if (!row.our) return;
        const gap = row.our.price - row.min;
        if (row.minM !== ourName() && gap > state.settings.threshold) {
          list.push({
            station: row.station,
            product: prod,
            platform: plat,
            our: row.our.price,
            min: row.min,
            minM: row.minM,
            gap: Math.round(gap * 100) / 100,
            date: row.maxDate,
            level: gap >= 0.2 ? 'high' : (gap >= 0.12 ? 'mid' : 'low')
          });
        }
      });
    });
  });
  list.sort((a, b) => b.gap - a.gap);
  return list;
}

/* 最低价保持率：我方在各平台、各站、各油品中排名第一的占比 */
function keepRate() {
  let total = 0, win = 0;
  state.platforms.forEach(plat => {
    state.products.forEach(prod => {
      priceRows(prod, plat).forEach(row => {
        if (!row.our) return;
        total++;
        if (row.our.price <= row.min + 0.001) win++;
      });
    });
  });
  return total ? win / total : 0;
}

/* ---------------- 首页看板 ---------------- */
function renderDashboard() {
  const alerts = buildAlerts();
  $('#kpi-stations').textContent = state.stations.filter(s => s.status === '合作中').length;
  $('#kpi-platforms').textContent = state.platforms.length;
  $('#kpi-merchants').textContent = state.merchants.length;
  $('#kpi-records').textContent = state.records.length;
  const today = todayStr();
  $('#kpi-today').textContent = state.records.filter(r => r.date === today).length;
  const rate = keepRate();
  $('#kpi-alerts').textContent = alerts.length;
  $('#kpi-rank').textContent = pct(rate);
  $('#side-alerts').textContent = alerts.length;
  $('#side-rate').textContent = pct(rate);

  const badge = $('#nav-badge');
  if (alerts.length) {
    badge.textContent = alerts.length;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  renderAlertStrip(alerts);
  renderCompare();
  renderTrend();
  renderPlatformHealth();
  renderTodo();
}

function renderAlertStrip(alerts) {
  const el = $('#alert-strip');
  if (!alerts.length) {
    el.className = 'alert-strip ok';
    el.innerHTML = '<span class="dot"></span><strong>价格平稳</strong>各合作平台上的服务商优惠价中，我方均保持最低，无需调价。';
    el.onclick = null;
    el.style.cursor = 'default';
    return;
  }
  const top = alerts[0];
  el.className = 'alert-strip';
  el.innerHTML = '<span class="dot"></span>' +
    '<strong>被竞品反超 ' + alerts.length + ' 处</strong>' +
    '<span>「' + esc(top.platform) + '」上，' + esc(top.station.name) + ' ' + esc(top.product) +
    ' 被「' + esc(top.minM) + '」低 ' + money(top.gap) + ' 元/L</span>' +
    '<span class="more">前往 AI 智能中心处理 →</span>';
  el.onclick = () => goPage('ai');
  el.style.cursor = 'pointer';
}

function renderCompare() {
  const platSel = $('#compare-platform');
  const prodSel = $('#compare-product');
  if (platSel.options.length !== state.platforms.length) {
    platSel.innerHTML = state.platforms.map(p => '<option>' + esc(p) + '</option>').join('');
  }
  if (prodSel.options.length !== state.products.length) {
    prodSel.innerHTML = state.products.map(p => '<option>' + esc(p) + '</option>').join('');
  }
  const platform = platSel.value || state.platforms[0];
  const product = prodSel.value || state.products[0];
  const rows = priceRows(product, platform);
  const table = $('#compare-table');
  const me = ourName();

  let html = '<thead><tr><th>加油站</th>' +
    state.merchants.map(m => '<th class="num">' + (m === me ? ourLabel() : esc(m)) + '</th>').join('') +
    '<th class="num">差距</th><th>状态</th></tr></thead><tbody>';

  if (!rows.length) {
    html += '<tr><td colspan="' + (state.merchants.length + 3) + '" class="center muted">该平台上暂无价格数据，请先到「价格录入」添加</td></tr>';
  }
  rows.forEach(row => {
    const isWin = row.our && row.our.price <= row.min + 0.001;
    html += '<tr><td><div class="cell-title">' + esc(row.station.name) + '</div>' +
      '<div class="cell-sub">' + esc(row.station.area) + ' · ' + esc(row.maxDate) + '</div></td>';
    state.merchants.forEach(m => {
      const c = row.cells[m];
      const best = c && c.price <= row.min + 0.001;
      html += '<td class="num' + (best ? ' best' : '') + '">' + (c ? money(c.price) : '—') + '</td>';
    });
    html += '<td class="num">' + (row.gap == null ? '—' : (row.gap >= 0 ? '+' : '') + money(row.gap)) + '</td>';
    html += '<td>' + (isWin
      ? '<span class="badge green">保持最低</span>'
      : '<span class="badge red">被 ' + esc(row.minM) + ' 反超</span>') + '</td></tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

function renderTrend() {
  const platSel = $('#trend-platform');
  const stSel = $('#trend-station');
  const prSel = $('#trend-product');
  if (platSel.options.length !== state.platforms.length) {
    platSel.innerHTML = state.platforms.map(p => '<option>' + esc(p) + '</option>').join('');
  }
  if (stSel.options.length !== state.stations.length) {
    stSel.innerHTML = state.stations.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('');
  }
  if (prSel.options.length !== state.products.length) {
    prSel.innerHTML = state.products.map(p => '<option>' + esc(p) + '</option>').join('');
  }
  const platform = platSel.value || state.platforms[0];
  const stationId = stSel.value || (state.stations[0] && state.stations[0].id);
  const product = prSel.value || state.products[0];
  if (!stationId) return;

  const dates = [];
  for (let d = 6; d >= 0; d--) dates.push(dayAgo(d));
  const me = ourName();
  const colors = ['#FF6B00', '#2563EB', '#0E9F6E', '#9333EA', '#DC2626', '#0891B2'];

  const datasets = state.merchants.map((m, i) => {
    const data = dates.map(dt => {
      const r = state.records.find(x =>
        x.stationId === stationId && x.product === product && x.platform === platform &&
        x.merchant === m && x.date === dt);
      return r ? r.price : null;
    });
    return {
      label: m === me ? m + '（我方）' : m,
      data,
      borderColor: colors[i % colors.length],
      backgroundColor: colors[i % colors.length],
      borderWidth: m === me ? 3 : 1.6,
      borderDash: m === me ? [] : [5, 3],
      tension: 0.35,
      pointRadius: 2.5,
      pointHoverRadius: 5,
      spanGaps: true
    };
  });

  const box = $('.chart-box');
  if (typeof Chart === 'undefined') {
    box.innerHTML = '<div class="chart-fallback">图表库加载失败（需联网加载 Chart.js），价格数据仍可在左侧比对表中查看。</div>';
    return;
  }
  if (!box.querySelector('canvas')) {
    box.innerHTML = '<canvas id="trend-chart"></canvas>';
  }
  const ctx = $('#trend-chart').getContext('2d');
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(ctx, {
    type: 'line',
    data: { labels: dates.map(shortDate), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 }, padding: 12, usePointStyle: true } },
        tooltip: { callbacks: { label: c => c.dataset.label + '：' + (c.parsed.y == null ? '无数据' : c.parsed.y.toFixed(2) + ' 元/L') } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#64748B' } },
        y: { grid: { color: '#F1F5F9' }, ticks: { font: { size: 11 }, color: '#64748B', callback: v => v.toFixed(2) } }
      }
    }
  });
}

/* 各平台竞争态势：每个平台下我方保持最低价的组合占比 */
function renderPlatformHealth() {
  const box = $('#platform-health');
  if (!box) return;
  const alerts = buildAlerts();
  box.innerHTML = state.platforms.map(plat => {
    let total = 0, win = 0;
    state.products.forEach(prod => {
      priceRows(prod, plat).forEach(row => {
        if (!row.our) return;
        total++;
        if (row.our.price <= row.min + 0.001) win++;
      });
    });
    const rate = total ? win / total : 0;
    const warn = alerts.filter(a => a.platform === plat).length;
    const low = total > 0 && rate < 0.6;
    return '<div class="platform-tile">' +
      '<div class="pt-head"><span class="pt-name">' + esc(plat) + '</span>' +
      '<span class="pt-rate' + (low ? ' low' : '') + '">' + pct(rate) + '</span></div>' +
      '<div class="pt-bar"><i style="width:' + (rate * 100).toFixed(0) + '%"></i></div>' +
      '<div class="pt-foot"><span>共 ' + total + ' 个组合</span><span>' +
      (warn ? '预警 ' + warn + ' 处' : '无预警') + '</span></div>' +
      '</div>';
  }).join('');
}

/* 优先处理建议：按价差排序，取前 5 条可安全跟价的组合 */
function renderTodo() {
  const box = $('#todo-list');
  if (!box) return;
  const list = computeAdvice().filter(r => r.gap > 0 && r.safe).slice(0, 5);
  if (!list.length) {
    box.innerHTML = '<div class="empty"><div class="empty-mark">OK</div>' +
      '<p>当前没有需要处理的抢占，我方在各平台均保持最低价。</p></div>';
    return;
  }
  box.innerHTML = list.map(r =>
    '<div class="todo-item">' +
      '<div class="ti-main"><strong>' + esc(r.station.name) + '</strong>' +
      '<p>' + esc(r.product) + ' · ' + esc(r.platform) + ' · 低我方 ' + money(r.gap) + ' 元/L</p></div>' +
      '<div class="ti-price"><span>建议价</span><b>' + money(r.suggested) + '</b></div>' +
      '<button class="btn primary small" data-apply data-sid="' + r.station.id + '"' +
      ' data-plat="' + esc(r.platform) + '" data-prod="' + esc(r.product) + '"' +
      ' data-price="' + r.suggested + '">采纳</button>' +
      '</div>'
  ).join('');
}

/* ---------------- 加油站管理 ---------------- */
function renderStations() {
  const active = state.stations.filter(s => s.status === '合作中').length;
  const paused = state.stations.length - active;
  $('#st-active').textContent = active;
  $('#st-total').textContent = state.stations.length;
  $('#st-areas').textContent = new Set(state.stations.map(s => s.area)).size;
  $('#st-paused').textContent = paused;
  let covered = 0;
  state.stations.forEach(st => {
    const plats = new Set(state.records.filter(r => r.stationId === st.id).map(r => r.platform));
    covered += plats.size;
  });
  const full = state.stations.length * state.platforms.length;
  $('#st-coverage').textContent = full ? pct(covered / full) : '0%';

  const kw = ($('#station-search').value || '').trim();
  const tbody = $('#station-table tbody');
  const list = state.stations.filter(s =>
    !kw || s.name.includes(kw) || s.area.includes(kw) || s.brand.includes(kw)
  );
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="center muted">没有找到匹配的加油站</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(st => {
    const plats = new Set(state.records.filter(r => r.stationId === st.id).map(r => r.platform));
    const active = st.status === '合作中';
    return '<tr>' +
      '<td><div class="cell-title">' + esc(st.name) + '</div><div class="cell-sub">编号 ' + esc(st.id) + '</div></td>' +
      '<td>' + esc(st.brand) + '</td>' +
      '<td>' + esc(st.area) + '</td>' +
      '<td class="muted">' + esc(st.address) + '</td>' +
      '<td><span class="badge ' + (active ? 'green' : 'gray') + '">' + esc(st.status) + '</span></td>' +
      '<td><span class="badge ' + (plats.size >= 3 ? 'green' : 'amber') + '">' + plats.size + ' / ' + state.platforms.length + ' 平台</span></td>' +
      '<td class="right">' +
        '<button class="btn small" data-edit="' + st.id + '">编辑</button> ' +
        '<button class="btn small danger" data-del="' + st.id + '">删除</button>' +
      '</td></tr>';
  }).join('');
}

let editingStationId = null;
function openStationDialog(st) {
  editingStationId = st ? st.id : null;
  $('#station-dialog-title').textContent = st ? '编辑加油站' : '新增加油站';
  $('#sf-name').value = st ? st.name : '';
  $('#sf-brand').value = st ? st.brand : '中石化';
  $('#sf-area').value = st ? st.area : '';
  $('#sf-address').value = st ? st.address : '';
  $('#sf-status').value = st ? st.status : '合作中';
  $('#station-dialog').showModal();
}

function saveStation(e) {
  e.preventDefault();
  const payload = {
    name: $('#sf-name').value.trim(),
    brand: $('#sf-brand').value,
    area: $('#sf-area').value.trim() || '未填写',
    address: $('#sf-address').value.trim() || '未填写',
    status: $('#sf-status').value
  };
  if (!payload.name) return;
  if (editingStationId) {
    const st = state.stations.find(s => s.id === editingStationId);
    Object.assign(st, payload);
    toast('已保存修改', 'ok');
  } else {
    state.stations.push(Object.assign({ id: 'S' + (Date.now() % 100000) }, payload));
    toast('已新增加油站', 'ok');
  }
  saveState();
  $('#station-dialog').close();
  renderStations();
  renderPriceSelectors();
  renderDashboard();
}

function deleteStation(id) {
  const st = state.stations.find(s => s.id === id);
  if (!st) return;
  if (!confirm('删除「' + st.name + '」及其全部价格记录？此操作不可撤销。')) return;
  state.stations = state.stations.filter(s => s.id !== id);
  state.records = state.records.filter(r => r.stationId !== id);
  saveState();
  renderStations();
  renderPriceSelectors();
  renderRecords();
  renderLogs();
  renderDashboard();
  renderAI();
}

/* ---------------- 价格录入 ---------------- */
function renderPriceSelectors() {
  const stSel = $('#pf-station');
  const keepSt = stSel.value;
  stSel.innerHTML = state.stations.map(s => '<option value="' + s.id + '">' + esc(s.name) + '</option>').join('');
  if (keepSt && state.stations.some(s => s.id === keepSt)) stSel.value = keepSt;

  const prSel = $('#pf-product');
  const keepPr = prSel.value;
  prSel.innerHTML = state.products.map(p => '<option>' + esc(p) + '</option>').join('');
  if (keepPr && state.products.includes(keepPr)) prSel.value = keepPr;

  const plSel = $('#pf-platform');
  const keepPl = plSel.value;
  plSel.innerHTML = state.platforms.map(p => '<option>' + esc(p) + '</option>').join('');
  if (keepPl && state.platforms.includes(keepPl)) plSel.value = keepPl;

  const mSel = $('#pf-merchant');
  const keepM = mSel.value;
  mSel.innerHTML = state.merchants.map((m, i) => '<option value="' + esc(m) + '">' + esc(m) + (i === 0 ? '（我方）' : '') + '</option>').join('');
  if (keepM && state.merchants.includes(keepM)) mSel.value = keepM;

  if (!$('#pf-date').value) $('#pf-date').value = todayStr();
}

function submitPrice(e) {
  e.preventDefault();
  const stationId = $('#pf-station').value;
  const product = $('#pf-product').value;
  const platform = $('#pf-platform').value;
  const merchant = $('#pf-merchant').value;
  const price = parseFloat($('#pf-price').value);
  const date = $('#pf-date').value || todayStr();
  if (!stationId || !product || !platform || !merchant || !isFinite(price) || price <= 0) {
    toast('请填写完整的价格信息', 'error');
    return;
  }
  saveRecord({ stationId, product, platform, merchant, date, price, source: '手动录入' });
  $('#pf-price').value = '';
  toast('价格已保存：' + money(price) + ' 元/L', 'ok');
  renderRecords();
  renderLogs();
  renderDashboard();
  renderAI();
}

function saveRecord(item) {
  // 同一天同一站同一油品同一平台同一服务商，视为覆盖更新
  const exist = state.records.find(r =>
    r.stationId === item.stationId && r.product === item.product &&
    r.platform === item.platform && r.merchant === item.merchant && r.date === item.date
  );
  const prevPrice = exist ? exist.price : null;
  if (exist) {
    exist.price = item.price;
    exist.source = item.source;
  } else {
    state.records.push(Object.assign({ id: uid('R') }, item));
  }
  // 仅记录我方服务商价格的实际变动
  if (item.merchant === ourName() && prevPrice != null && Math.abs(prevPrice - item.price) >= 0.005) {
    addLog(item.stationId, item.product, item.platform, prevPrice, item.price, item.source, item.date);
  }
  saveState();
}

function addLog(stationId, product, platform, from, to, source, date) {
  if (!state.logs) state.logs = [];
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  state.logs.unshift({
    id: uid('L'),
    time: (date || todayStr()) + ' ' + hhmm,
    stationId,
    product,
    platform,
    from,
    to,
    delta: Math.round((to - from) * 100) / 100,
    operator: state.settings.operator || '运营专员',
    source
  });
  if (state.logs.length > 300) state.logs.length = 300;
}

function renderLogs() {
  const logs = (state.logs || []).slice(0, 30);
  const tbody = $('#log-table tbody');
  $('#log-count').textContent = '共 ' + (state.logs || []).length + ' 次';
  if (!logs.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="center muted">暂无调价记录，修改我方服务商价格后会自动留痕</td></tr>';
    return;
  }
  tbody.innerHTML = logs.map(l => {
    const st = state.stations.find(s => s.id === l.stationId);
    const up = l.delta > 0;
    return '<tr>' +
      '<td class="muted">' + esc(l.time) + '</td>' +
      '<td>' + esc(st ? st.name : '已删除站点') + '<div class="cell-sub">' + esc(l.product) + '</div></td>' +
      '<td class="muted">' + esc(l.platform) + '</td>' +
      '<td class="num">' + money(l.from) + '</td>' +
      '<td class="num">' + money(l.to) + '</td>' +
      '<td class="num" style="color:' + (up ? '#E02424' : '#0E9F6E') + '">' + (up ? '+' : '') + money(l.delta) + '</td>' +
      '<td>' + esc(l.operator) + '</td>' +
      '<td class="muted">' + esc(l.source) + '</td>' +
      '</tr>';
  }).join('');
}

/* --------- 价格记录 --------- */
function renderRecords() {
  const kw = ($('#record-search').value || '').trim();
  const tbody = $('#record-table tbody');
  let list = state.records.slice().sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id));
  if (kw) {
    list = list.filter(r => {
      const st = state.stations.find(s => s.id === r.stationId);
      return st && st.name.includes(kw);
    });
  }
  $('#record-count').textContent = '共 ' + state.records.length + ' 条记录，当前显示 ' + Math.min(list.length, 200) + ' 条';
  list = list.slice(0, 200);

  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="center muted">暂无记录</td></tr>';
    return;
  }
  tbody.innerHTML = list.map(r => {
    const st = state.stations.find(s => s.id === r.stationId);
    const isOur = r.merchant === ourName();
    return '<tr>' +
      '<td class="muted">' + esc(r.date) + '</td>' +
      '<td>' + esc(st ? st.name : '已删除站点') + '</td>' +
      '<td>' + esc(r.product) + '</td>' +
      '<td>' + esc(r.platform) + '</td>' +
      '<td>' + (isOur ? '<span class="badge amber">' + esc(r.merchant) + '（我方）</span>' : esc(r.merchant)) + '</td>' +
      '<td class="num">' + money(r.price) + '</td>' +
      '<td class="muted">' + esc(r.source) + '</td>' +
      '<td class="right"><button class="btn small danger" data-del-record="' + r.id + '">删除</button></td>' +
      '</tr>';
  }).join('');
}

function deleteRecord(id) {
  state.records = state.records.filter(r => r.id !== id);
  saveState();
  renderRecords();
  renderLogs();
  renderDashboard();
  renderAI();
}

/* ---------------- 批量导入 ---------------- */
function parseCSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  return lines.map(line => {
    // 简单 CSV 解析，支持英文逗号与中文逗号
    const cells = line.split(',').length >= 6 ? line.split(',') : line.split('，');
    return cells.map(c => c.trim().replace(/^"|"$/g, ''));
  });
}

function doImport(rows) {
  const result = $('#import-result');
  if (!rows.length) {
    result.innerHTML = '<span class="err">没有可导入的数据</span>';
    return;
  }
  let ok = 0;
  const errors = [];

  rows.forEach((cells, idx) => {
    const lineNo = idx + 1;
    if (cells.length < 6) { errors.push('第 ' + lineNo + ' 行：列数不足 6 列'); return; }
    const [stName, product, platform, merchant, date, priceRaw] = cells;
    if (/加油站|station/i.test(stName) && idx === 0) return; // 跳过表头

    const st = state.stations.find(s => s.name === stName);
    if (!st) { errors.push('第 ' + lineNo + ' 行：未找到加油站「' + stName + '」'); return; }
    if (!state.products.includes(product)) { errors.push('第 ' + lineNo + ' 行：油品「' + product + '」不在系统内'); return; }
    if (!state.platforms.includes(platform)) { errors.push('第 ' + lineNo + ' 行：平台「' + platform + '」不在系统内'); return; }
    if (!state.merchants.includes(merchant)) { errors.push('第 ' + lineNo + ' 行：服务商「' + merchant + '」不在系统内'); return; }
    const price = parseFloat(priceRaw);
    if (!isFinite(price) || price <= 0) { errors.push('第 ' + lineNo + ' 行：价格「' + priceRaw + '」无效'); return; }
    const dt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr();

    saveRecord({ stationId: st.id, product, platform, merchant, date: dt, price: Math.round(price * 100) / 100, source: '批量导入' });
    ok++;
  });

  saveState();
  result.innerHTML = '<span class="ok">成功导入 ' + ok + ' 条</span>' +
    (errors.length ? '<div class="err" style="margin-top:6px">失败 ' + errors.length + ' 条：</div><ul>' +
      errors.slice(0, 8).map(e => '<li>' + esc(e) + '</li>').join('') +
      (errors.length > 8 ? '<li>…其余 ' + (errors.length - 8) + ' 条省略</li>' : '') + '</ul>' : '');
  toast('导入完成：成功 ' + ok + ' 条', ok ? 'ok' : 'error');
  renderRecords();
  renderLogs();
  renderDashboard();
  renderAI();
}

function importFromFile(file) {
  if (!file) return;
  const isExcel = /\.(xlsx|xls)$/i.test(file.name);
  const reader = new FileReader();

  if (isExcel) {
    if (typeof XLSX === 'undefined') {
      toast('Excel 解析库未加载，请联网后重试或改用 CSV', 'error');
      return;
    }
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false })
          .map(r => r.map(c => String(c == null ? '' : c).trim()))
          .filter(r => r.some(c => c));
        doImport(rows);
      } catch (err) {
        toast('Excel 解析失败：' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    reader.onload = ev => {
      const text = String(ev.target.result || '');
      doImport(parseCSV(text));
    };
    reader.readAsText(file, 'utf-8');
  }
}

function downloadTemplate() {
  const me = ourName();
  const rows = [
    '加油站,油品,平台,服务商,日期,优惠后价格',
    '中石化深南大道站,92#,高德地图,' + me + ',' + todayStr() + ',7.20',
    '中石化深南大道站,92#,高德地图,小吉加油,' + todayStr() + ',7.15'
  ];
  // 加 BOM 让 Excel 正确识别中文
  const blob = new Blob(['\ufeff' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '价格导入模板.csv';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('模板已下载', 'ok');
}

/* ---------------- AI 智能中心 ---------------- */
function renderAI() {
  const alerts = buildAlerts();
  const surges = buildSurges();
  $('#ai-count').textContent = alerts.length;
  $('#ai-surge-count').textContent = surges.length;
  $('#ai-rate').textContent = pct(keepRate());
  renderWarnings(alerts);
  renderSurges(surges);
  renderAdvice();
}

/* 异常突变：同一站+油品+平台+服务商，最近两日价格变化超过阈值 */
function buildSurges() {
  const threshold = state.settings.surge || 0.1;
  const groups = {};
  state.records.forEach(r => {
    const k = [r.stationId, r.product, r.platform, r.merchant].join('|');
    (groups[k] = groups[k] || []).push(r);
  });
  const list = [];
  Object.keys(groups).forEach(k => {
    const arr = groups[k].slice().sort((a, b) => a.date.localeCompare(b.date));
    if (arr.length < 2) return;
    const last = arr[arr.length - 1];
    let prev = null;
    for (let i = arr.length - 2; i >= 0; i--) {
      if (arr[i].date !== last.date) { prev = arr[i]; break; }
    }
    if (!prev) return;
    const delta = Math.round((last.price - prev.price) * 100) / 100;
    if (Math.abs(delta) < threshold) return;
    const st = state.stations.find(s => s.id === last.stationId);
    if (!st) return;
    list.push({
      station: st,
      product: last.product,
      platform: last.platform,
      merchant: last.merchant,
      isOur: last.merchant === ourName(),
      from: prev.price,
      fromDate: prev.date,
      to: last.price,
      date: last.date,
      delta
    });
  });
  list.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  return list;
}

function renderSurges(surges) {
  const box = $('#surge-list');
  const threshold = state.settings.surge || 0.1;
  if (!surges.length) {
    box.innerHTML = '<div class="empty"><div class="empty-mark">OK</div>' +
      '<p>未检测到单日涨跌超过 ' + money(threshold) + ' 元/L 的异常突变。</p></div>';
    return;
  }
  box.innerHTML = surges.map(s => {
    let tag, tagClass;
    if (s.isOur) {
      tag = s.delta < 0 ? '我方调价' : '我方上调';
      tagClass = 'mid';
    } else if (s.delta < 0) {
      tag = '竞品突降';
      tagClass = 'high';
    } else {
      tag = '竞品上调';
      tagClass = 'mid';
    }
    const color = s.delta < 0 ? '#0E9F6E' : '#E02424';
    return '<div class="alert-card ' + tagClass + '">' +
      '<div class="alert-main">' +
        '<strong>' + esc(s.station.name) + ' · ' + esc(s.product) + '</strong>' +
        '<span class="sev-tag" style="margin-left:8px">' + tag + '</span>' +
        '<p>「' + esc(s.platform) + '」上，' + esc(s.merchant) + ' 从 ' + money(s.from) + ' → ' + money(s.to) +
        ' 元/L（' + esc(s.fromDate) + ' → ' + esc(s.date) + '），单日变动 <b style="color:' + color + '">' +
        (s.delta > 0 ? '+' : '') + money(s.delta) + '</b> 元/L。</p>' +
        (s.delta < 0 && !s.isOur
          ? '<span class="badge amber">建议核查竞品活动原因，评估是否需要跟价</span>'
          : '<span class="badge gray">已记录，供复盘参考</span>') +
      '</div>' +
      '<div class="alert-side"><div class="price-now"><span>' + esc(s.date) + ' 现价</span><b style="color:' + color + '">' + money(s.to) + '</b></div></div>' +
      '</div>';
  }).join('');
}

function renderWarnings(alerts) {
  const box = $('#warning-list');
  if (!alerts.length) {
    box.innerHTML = '<div class="empty"><div class="empty-mark">OK</div>' +
      '<p>当前没有价格预警。各合作平台上，我方优惠价均等于或低于竞品最低价。</p></div>';
    return;
  }
  const levelText = { high: '高优先级', mid: '中优先级', low: '观察' };
  box.innerHTML = alerts.map(a => {
    return '<div class="alert-card ' + a.level + '">' +
      '<div class="alert-main">' +
        '<strong>' + esc(a.station.name) + ' · ' + esc(a.product) + '</strong>' +
        '<span class="sev-tag" style="margin-left:8px">' + levelText[a.level] + '</span>' +
        '<p>在「' + esc(a.platform) + '」上，「' + esc(a.minM) + '」优惠价 ' + money(a.min) +
        ' 元/L，比我方低 ' + money(a.gap) + ' 元/L，我方在该平台的展示位置已被反超（数据日期 ' + esc(a.date) + '）。</p>' +
        '<span class="badge amber">建议在该平台调价至 ' + money(Math.max(a.min - 0.02, 0)) + ' 元/L</span>' +
      '</div>' +
      '<div class="alert-side">' +
        '<div class="price-now"><span>我方现价</span><b>' + money(a.our) + '</b></div>' +
        '<button class="btn primary small" data-apply data-sid="' + a.station.id + '" data-plat="' + esc(a.platform) + '"' +
        ' data-prod="' + esc(a.product) + '" data-price="' + (Math.max(a.min - 0.02, 0)) + '">采纳建议价</button>' +
      '</div></div>';
  }).join('');
}

function computeAdvice() {
  const list = [];
  const me = ourName();
  state.platforms.forEach(plat => {
    state.products.forEach(prod => {
      priceRows(prod, plat).forEach(row => {
        if (!row.our) return;
        const cost = COST[prod] || Math.max(row.min - 0.3, 0);
        const floor = Math.round((cost + 0.03) * 100) / 100;
        const target = Math.round((row.min - 0.02) * 100) / 100;
        const suggested = Math.max(target, floor);
        const gap = row.minM === me ? 0 : Math.round((row.our.price - row.min) * 100) / 100;
        let reason = '';
        if (gap <= 0) {
          reason = '我方在该平台已保持最低价，可维持现状观察竞品动作';
        } else if (target < floor) {
          reason = '竞品低价接近成本线，不建议跟价，建议通过赠品或满减维持竞争力';
        } else if (gap >= 0.25) {
          reason = '竞品大幅让价，价差 ' + money(gap) + ' 元/L，需优先调价夺回该平台首位';
        } else {
          reason = '竞品低 ' + money(gap) + ' 元/L，小幅让价即可夺回该平台最低价位置';
        }
        list.push({
          station: row.station,
          product: prod,
          platform: plat,
          our: row.our.price,
          min: row.min,
          minM: row.minM,
          suggested,
          cost,
          margin: Math.round((suggested - cost) * 100) / 100,
          gap,
          reason,
          safe: !(target < floor)
        });
      });
    });
  });
  list.sort((a, b) => b.gap - a.gap);
  return list;
}

function renderAdvice() {
  const rows = computeAdvice();
  const tbody = $('#advice-table tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="center muted">暂无可用价格数据</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(r => {
    const need = r.gap > 0;
    return '<tr>' +
      '<td><div class="cell-title">' + esc(r.station.name) + '</div><div class="cell-sub">' + esc(r.product) + ' · ' + esc(r.platform) + '</div></td>' +
      '<td class="num">' + money(r.our) + '</td>' +
      '<td class="num">' + money(r.min) + '<div class="cell-sub">' + esc(r.minM) + '</div></td>' +
      '<td class="num" style="color:' + (need ? '#E02424' : '#0E9F6E') + '">' + money(r.suggested) + '</td>' +
      '<td class="num">' + money(r.margin) + '</td>' +
      '<td class="muted" style="max-width:280px;white-space:normal">' + esc(r.reason) + '</td>' +
      '<td class="right">' + (need && r.safe
        ? '<button class="btn primary small" data-apply data-sid="' + r.station.id + '" data-plat="' + esc(r.platform) + '"' +
          ' data-prod="' + esc(r.product) + '" data-price="' + r.suggested + '">采纳调价</button>'
        : '<span class="badge ' + (need ? 'amber' : 'green') + '">' + (need ? '审慎跟价' : '无需调整') + '</span>') + '</td>' +
      '</tr>';
  }).join('');
}

function applySuggested(btn) {
  const sid = btn.getAttribute('data-sid');
  const platform = btn.getAttribute('data-plat');
  const product = btn.getAttribute('data-prod');
  const price = parseFloat(btn.getAttribute('data-price'));
  const st = state.stations.find(s => s.id === sid);
  if (!st || !platform || !isFinite(price)) return;
  saveRecord({
    stationId: sid,
    product,
    platform,
    merchant: ourName(),
    date: todayStr(),
    price: Math.round(price * 100) / 100,
    source: 'AI建议采纳'
  });
  toast('「' + platform + '」' + st.name + ' ' + product + ' 已调至 ' + money(price) + ' 元/L', 'ok');
  renderAll();
}

/* --------- 自动日报 --------- */
let lastReportText = '';

function generateReport() {
  const today = todayStr();
  const yesterday = dayAgo(1);
  const alerts = buildAlerts();
  const activeStations = state.stations.filter(s => s.status === '合作中').length;
  const todayRecords = state.records.filter(r => r.date === today);
  const rate = keepRate();
  const me = ourName();

  // 今日我方在各平台的价格变动
  const changes = [];
  state.stations.forEach(st => {
    state.products.forEach(prod => {
      state.platforms.forEach(plat => {
        const find = date => state.records.find(r =>
          r.stationId === st.id && r.product === prod && r.platform === plat &&
          r.merchant === me && r.date === date);
        const now = find(today);
        const prev = find(yesterday);
        if (now && prev && Math.abs(now.price - prev.price) >= 0.01) {
          changes.push({
            station: st, product: prod, platform: plat,
            from: prev.price, to: now.price,
            delta: Math.round((now.price - prev.price) * 100) / 100
          });
        }
      });
    });
  });

  const upCount = changes.filter(c => c.delta > 0).length;
  const downCount = changes.filter(c => c.delta < 0).length;

  const lines = [];
  lines.push('【油站价哨】加油站优惠价格运营日报 · ' + today);
  lines.push('');
  lines.push('一、今日概况');
  lines.push('- 监控合作加油站 ' + activeStations + ' 座，覆盖 ' + state.platforms.length + ' 个合作平台（' + state.platforms.join('、') + '）');
  lines.push('- 平台在架服务商 ' + state.merchants.length + ' 家（我方：' + me + '），今日新增/更新价格记录 ' + todayRecords.length + ' 条');
  lines.push('- 当前预警 ' + alerts.length + ' 处，最低价保持率 ' + pct(rate) + '；我方调价 ' + changes.length + ' 次（上调 ' + upCount + ' 次，下调 ' + downCount + ' 次）');
  lines.push('');
  lines.push('二、我方今日调价');
  if (changes.length) {
    changes.slice(0, 10).forEach(c => {
      lines.push('- 「' + c.platform + '」' + c.station.name + ' ' + c.product + '：' + money(c.from) + ' → ' + money(c.to) +
        ' 元/L（' + (c.delta > 0 ? '上调 ' : '下调 ') + money(Math.abs(c.delta)) + ' 元）');
    });
    if (changes.length > 10) lines.push('- …其余 ' + (changes.length - 10) + ' 次调价略');
  } else {
    lines.push('- 今日我方价格未发生变动');
  }
  lines.push('');
  lines.push('三、竞品抢占情况');
  if (alerts.length) {
    alerts.forEach(a => {
      lines.push('- 「' + a.platform + '」' + a.station.name + ' ' + a.product + '：' + a.minM + ' 报价 ' + money(a.min) +
        ' 元/L，低我方 ' + money(a.gap) + ' 元/L');
    });
  } else {
    lines.push('- 未发现竞品低价抢占情况');
  }
  lines.push('');
  lines.push('四、行动建议');
  if (alerts.length) {
    alerts.slice(0, 5).forEach(a => {
      lines.push('- 「' + a.platform + '」' + a.station.name + ' ' + a.product + '：建议调价至 ' +
        money(Math.max(a.min - 0.02, 0)) + ' 元/L，夺回该平台最低价位置');
    });
  } else {
    lines.push('- 保持现有价格策略，持续观察竞品动态');
  }
  lines.push('');
  lines.push('五、结论');
  lines.push('- 今日竞品价格整体' + (alerts.length ? '偏激进，建议优先处理高优先级预警站点' : '平稳，我方价格策略有效') +
    '；最低价保持率 ' + pct(rate) + '，' + (rate >= 0.8 ? '平台位置稳固' : '需加强价格竞争力'));

  lastReportText = lines.join('\n');

  const htmlChanges = changes.length
    ? '<ul>' + changes.slice(0, 10).map(c => '<li>「' + esc(c.platform) + '」' + esc(c.station.name) + ' ' + esc(c.product) + '：' + money(c.from) + ' → ' + money(c.to) +
      ' 元/L（' + (c.delta > 0 ? '上调 ' : '下调 ') + money(Math.abs(c.delta)) + ' 元）</li>').join('') +
      (changes.length > 10 ? '<li class="muted">…其余 ' + (changes.length - 10) + ' 次调价略</li>' : '') + '</ul>'
    : '<ul><li>今日我方价格未发生变动</li></ul>';

  const htmlAlerts = alerts.length
    ? '<ul>' + alerts.map(a => '<li><b>' + esc(a.station.name) + '</b> ' + esc(a.product) + '（' + esc(a.platform) + '）：' + esc(a.minM) +
      ' 报价 ' + money(a.min) + ' 元/L，低我方 ' + money(a.gap) + ' 元/L</li>').join('') + '</ul>'
    : '<ul><li>未发现竞品低价抢占情况</li></ul>';

  $('#report-body').innerHTML =
    '<div class="report-head">' +
      '<span class="tag">AI 生成 · 需人工复核</span>' +
      '<h3>' + today + ' 加油站价格运营日报</h3>' +
      '<p>监控 ' + activeStations + ' 座合作站 · ' + state.platforms.length + ' 个平台 · ' + state.merchants.length +
      ' 家服务商 · 预警 ' + alerts.length + ' 处 · 最低价保持率 ' + pct(rate) + '</p>' +
    '</div>' +
    '<div class="report-section"><h4>一、我方今日调价</h4>' + htmlChanges + '</div>' +
    '<div class="report-section"><h4>二、竞品抢占情况</h4>' + htmlAlerts + '</div>' +
    '<div class="report-section"><h4>三、行动建议</h4>' +
      '<ul>' + (alerts.length
        ? alerts.slice(0, 5).map(a => '<li>「' + esc(a.platform) + '」' + esc(a.station.name) + ' ' + esc(a.product) + '：建议调价至 ' + money(Math.max(a.min - 0.02, 0)) + ' 元/L</li>').join('')
        : '<li>保持现有价格策略，持续观察竞品动态</li>') + '</ul></div>' +
    '<div class="report-section"><h4>四、结论</h4><ul><li>今日竞品价格整体' +
      (alerts.length ? '偏激进，建议优先处理高优先级预警站点' : '平稳，我方价格策略有效') +
      '；最低价保持率 ' + pct(rate) + '，' + (rate >= 0.8 ? '平台位置稳固' : '需加强价格竞争力') + '</li></ul></div>';

  toast('日报已生成', 'ok');
}

/* ---------------- 设置 ---------------- */
function renderSettings() {
  $('#set-threshold').value = state.settings.threshold;
  $('#set-surge').value = state.settings.surge;
  $('#set-operator').value = state.settings.operator;

  const plBox = $('#platform-list');
  plBox.innerHTML = state.platforms.map(p =>
    '<span class="chip">' + esc(p) + '<button data-del-platform="' + esc(p) + '" title="移除">×</button></span>'
  ).join('');

  const prBox = $('#product-list');
  prBox.innerHTML = state.products.map(p =>
    '<span class="chip">' + esc(p) + '<button data-del-product="' + esc(p) + '" title="移除">×</button></span>'
  ).join('');

  const mBox = $('#merchant-list');
  mBox.innerHTML = state.merchants.map((m, i) => {
    const isOur = i === 0;
    return '<span class="chip">' + esc(m) + (isOur ? '<span class="badge amber">我方</span>' : '') +
      (isOur ? '' : '<button data-del-merchant="' + esc(m) + '" title="移除">×</button>') + '</span>';
  }).join('');
}

function addPlatform() {
  const name = $('#new-platform').value.trim();
  if (!name) return;
  if (state.platforms.includes(name)) { toast('该平台已存在', 'error'); return; }
  state.platforms.push(name);
  saveState();
  $('#new-platform').value = '';
  renderAll();
  toast('已添加平台：' + name, 'ok');
}

function removePlatform(name) {
  if (!confirm('移除平台「' + name + '」？该平台的历史价格记录将一并删除。')) return;
  state.platforms = state.platforms.filter(p => p !== name);
  state.records = state.records.filter(r => r.platform !== name);
  saveState();
  renderAll();
  toast('已移除平台：' + name, 'ok');
}

function addProduct() {
  const name = $('#new-product').value.trim();
  if (!name) return;
  if (state.products.includes(name)) { toast('该油品已存在', 'error'); return; }
  state.products.push(name);
  saveState();
  $('#new-product').value = '';
  renderAll();
  toast('已添加油品：' + name, 'ok');
}

function removeProduct(name) {
  if (!confirm('移除油品「' + name + '」？该油品的历史价格记录将一并删除。')) return;
  state.products = state.products.filter(p => p !== name);
  state.records = state.records.filter(r => r.product !== name);
  saveState();
  renderAll();
  toast('已移除油品：' + name, 'ok');
}

function addMerchant() {
  const name = $('#new-merchant').value.trim();
  if (!name) return;
  if (state.merchants.includes(name)) { toast('该服务商已存在', 'error'); return; }
  state.merchants.push(name);
  saveState();
  $('#new-merchant').value = '';
  renderAll();
  toast('已添加服务商：' + name, 'ok');
}

function removeMerchant(name) {
  if (name === ourName()) { toast('不能移除我方服务商', 'error'); return; }
  if (!confirm('移除服务商「' + name + '」？其历史价格记录将一并删除。')) return;
  state.merchants = state.merchants.filter(m => m !== name);
  state.records = state.records.filter(r => r.merchant !== name);
  saveState();
  renderAll();
  toast('已移除服务商：' + name, 'ok');
}

/* ---------------- 导出与重置 ---------------- */
function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function exportJSON() {
  downloadBlob(JSON.stringify(state, null, 2), '加油站价格数据_' + todayStr() + '.json', 'application/json');
  toast('已导出 JSON', 'ok');
}

function exportCSV() {
  const head = '加油站,油品,平台,服务商,日期,优惠后价格,来源';
  const lines = state.records.map(r => {
    const st = state.stations.find(s => s.id === r.stationId);
    return [st ? st.name : '', r.product, r.platform, r.merchant, r.date, r.price, r.source].join(',');
  });
  downloadBlob('\ufeff' + [head].concat(lines).join('\n'), '价格记录_' + todayStr() + '.csv', 'text/csv;charset=utf-8');
  toast('已导出 CSV', 'ok');
}

function resetDemo() {
  if (!confirm('重置将清空当前所有数据，并重新生成 8 座加油站、4 个合作平台与近 7 天演示价格。继续？')) return;
  state = genSeed();
  saveState();
  renderAll();
  toast('已重置演示数据', 'ok');
}

/* ---------------- 导航与初始化 ---------------- */
const PAGE_META = {
  dashboard: ['价格总览', '同一加油站、同一平台上，各服务商的优惠价与排名'],
  stations: ['加油站管理', '维护合作加油站档案与平台数据覆盖情况'],
  prices: ['价格录入 / 导入', '录入或批量导入各平台、各服务商的优惠价格'],
  ai: ['AI 智能中心', '价格预警、异常突变、调价建议与运营日报'],
  settings: ['设置', '预警阈值、平台、服务商与数据管理']
};

function goPage(name) {
  $$('.nav-item').forEach(b => b.classList.toggle('active', b.getAttribute('data-page') === name));
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  const meta = PAGE_META[name] || PAGE_META.dashboard;
  $('#page-title').textContent = meta[0];
  $('#page-subtitle').textContent = meta[1];
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'dashboard') renderDashboard();
  if (name === 'stations') renderStations();
  if (name === 'prices') { renderPriceSelectors(); renderRecords(); renderLogs(); }
  if (name === 'ai') renderAI();
  if (name === 'settings') renderSettings();
}

function renderAll() {
  renderDashboard();
  renderStations();
  renderPriceSelectors();
  renderRecords();
  renderLogs();
  renderAI();
  renderSettings();
}

function tickClock() {
  const d = new Date();
  const p = v => String(v).padStart(2, '0');
  const week = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  $('#today-chip').textContent = dateStr(d) + ' ' + week + ' ' +
    p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  const sideClock = $('#side-clock');
  if (sideClock) {
    sideClock.textContent = p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
}

function bindEvents() {
  $$('.nav-item').forEach(b => b.addEventListener('click', () => goPage(b.getAttribute('data-page'))));
  tickClock();
  setInterval(tickClock, 1000);
  $('#btn-refresh').addEventListener('click', () => { renderAll(); toast('数据已刷新', 'ok'); });
  $('#btn-goto-ai').addEventListener('click', () => goPage('ai'));

  $('#compare-platform').addEventListener('change', renderCompare);
  $('#compare-product').addEventListener('change', renderCompare);
  $('#trend-platform').addEventListener('change', renderTrend);
  $('#trend-station').addEventListener('change', renderTrend);
  $('#trend-product').addEventListener('change', renderTrend);

  $('#station-search').addEventListener('input', renderStations);
  $('#btn-add-station').addEventListener('click', () => openStationDialog(null));
  $('#station-form').addEventListener('submit', saveStation);
  $('#station-dialog-close').addEventListener('click', () => $('#station-dialog').close());
  $('#station-cancel').addEventListener('click', () => $('#station-dialog').close());
  $('#station-table').addEventListener('click', e => {
    const edit = e.target.getAttribute('data-edit');
    const del = e.target.getAttribute('data-del');
    if (edit) openStationDialog(state.stations.find(s => s.id === edit));
    if (del) deleteStation(del);
  });

  $('#price-form').addEventListener('submit', submitPrice);
  $('#record-search').addEventListener('input', renderRecords);
  $('#record-table').addEventListener('click', e => {
    const id = e.target.getAttribute('data-del-record');
    if (id) deleteRecord(id);
  });

  $('#file-input').addEventListener('change', e => {
    importFromFile(e.target.files[0]);
    e.target.value = '';
  });
  $('#btn-import-paste').addEventListener('click', () => {
    const text = $('#paste-area').value.trim();
    if (!text) { toast('请先粘贴表格内容', 'error'); return; }
    doImport(parseCSV(text));
  });
  $('#btn-template').addEventListener('click', downloadTemplate);

  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => x.classList.toggle('active', x === t));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + t.getAttribute('data-tab')));
  }));

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-apply]');
    if (btn) applySuggested(btn);
    const dp = e.target.getAttribute('data-del-platform');
    const dpr = e.target.getAttribute('data-del-product');
    const dm = e.target.getAttribute('data-del-merchant');
    if (dp) removePlatform(dp);
    if (dpr) removeProduct(dpr);
    if (dm) removeMerchant(dm);
  });

  $('#btn-report').addEventListener('click', generateReport);
  $('#btn-copy-report').addEventListener('click', () => {
    if (!lastReportText) { toast('请先生成日报', 'error'); return; }
    navigator.clipboard.writeText(lastReportText)
      .then(() => toast('日报已复制到剪贴板', 'ok'))
      .catch(() => toast('复制失败，请手动选择文本', 'error'));
  });

  $('#btn-save-settings').addEventListener('click', () => {
    const v = parseFloat($('#set-threshold').value);
    const s = parseFloat($('#set-surge').value);
    const operator = $('#set-operator').value.trim();
    if (!isFinite(v) || v < 0) { toast('请输入有效的预警阈值', 'error'); return; }
    if (!isFinite(s) || s < 0) { toast('请输入有效的突变阈值', 'error'); return; }
    state.settings.threshold = Math.round(v * 100) / 100;
    state.settings.surge = Math.round(s * 100) / 100;
    state.settings.operator = operator || '运营专员';
    saveState();
    renderAll();
    toast('设置已保存', 'ok');
  });
  $('#btn-add-platform').addEventListener('click', addPlatform);
  $('#btn-add-product').addEventListener('click', addProduct);
  $('#btn-add-merchant').addEventListener('click', addMerchant);

  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-csv').addEventListener('click', exportCSV);
  $('#btn-reset').addEventListener('click', resetDemo);
}

bindEvents();
renderAll();




