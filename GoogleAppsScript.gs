const CONFIG = {
  SERVER_URL: 'https://sectormap.dpdns.org',
  API_KEY: 'crypto-dashboard-2024',
  SHEET_NAME: 'Dashboard',
  RATING_SHEET_NAME: 'Rating',

  // Интервалы автообновления (минуты)
  DASHBOARD_REFRESH: 1,   // Dashboard каждую минуту
  RATING_REFRESH: 5       // Rating каждые 5 минут
};

// ============================================================================
// ПОРТФЕЛЬ — токены для мини-таблицы на Dashboard
// ============================================================================
const PORTFOLIO_TOKENS = [
  'ethereum',           // ETH
  'aerodrome-finance',  // AERO
  'curve-dao-token',    // CRV
  'chainlink',          // LINK
  'hyperliquid',        // HYPE
  'helium',             // HNT
  'pendle',             // PENDLE
  'metis-token',        // METIS
  'maple',              // SYRUP (CoinGecko ID: maple)
  'virtual-protocol',  // VIRTUAL (CoinGecko ID: virtual-protocol)
  'yearn-finance',      // YFI
  'centrifuge',         // CFG
  'giza',               // GIZA (AI Agents sector)
  'apex-token-2'        // APEX (Derivatives sector)
];

// Scoring система для Rating
const SCORING = {
  TOP1_SECTOR: 5, TOP2_SECTOR: 3, TOP3_SECTOR: 2,
  TOP1_GLOBAL: 10, TOP3_GLOBAL: 5, TOP10_GLOBAL: 2,
  BEAT_SECTOR_AVG: 1, BEAT_MARKET_AVG: 2,
  GREEN_DAY: 1, STRONG_GREEN: 3, MOON_DAY: 5
};

// Цвета секторов
const SECTOR_COLORS = {
  'Layer 1': '#FFD700', 'Layer 2': '#40E0D0', 'DEX': '#B19CD9', 'DEX Aggregators': '#9370DB',
  'Lending': '#77DD77', 'Derivatives': '#98FB98', 'Liquid Staking': '#FF69B4', 'Stablecoins': '#87CEEB',
  'Asset Management': '#DEB887', 'NFT Marketplaces': '#FF7F50', 'RWA': '#FFB347', 'Bridges': '#20B2AA',
  'Infrastructure': '#4DA6FF', 'DePIN': '#32CD32', 'Social': '#FF6B6B', 'Gaming': '#FF4500',
  'Memes': '#DDA0DD', 'Oracles': '#6495ED', 'Prediction Markets': '#DA70D6', 'AI Agents': '#00CED1'
};

// ============================================================================
// МЕНЮ И АВТОЗАПУСК
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 Crypto')
    .addItem('🔄 Обновить всё', 'updateAll')
    .addItem('🗑️ Сброс рейтинга', 'resetRating')
    .addToUi();

  // Автозапуск триггеров при открытии
  ensureTriggersExist();
}

function updateAll() {
  updateDashboard();
  updateRating();
}

function ensureTriggersExist() {
  const triggers = ScriptApp.getProjectTriggers();
  const hasDashboard = triggers.some(t => t.getHandlerFunction() === 'updateDashboard');
  const hasRating = triggers.some(t => t.getHandlerFunction() === 'updateRating');

  if (!hasDashboard) {
    ScriptApp.newTrigger('updateDashboard')
      .timeBased()
      .everyMinutes(CONFIG.DASHBOARD_REFRESH)
      .create();
    Logger.log('Dashboard trigger created: every ' + CONFIG.DASHBOARD_REFRESH + ' min');
  }

  if (!hasRating) {
    ScriptApp.newTrigger('updateRating')
      .timeBased()
      .everyMinutes(CONFIG.RATING_REFRESH)
      .create();
    Logger.log('Rating trigger created: every ' + CONFIG.RATING_REFRESH + ' min');
  }
}

function resetRating() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.RATING_SHEET_NAME);
  if (sheet) sheet.clear();
  Logger.log('Rating sheet cleared');
}

// ============================================================================
// ЗАГРУЗКА ДАННЫХ С СЕРВЕРА
// ============================================================================

function checkConnection() {
  try {
    const url = CONFIG.SERVER_URL + '/api/health';
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log('✅ Server OK: ' + data.tokenCount + ' tokens cached');
      return true;
    } else {
      Logger.log('❌ Server error: ' + response.getResponseCode());
      return false;
    }
  } catch (e) {
    Logger.log('❌ Connection error: ' + e.message);
    return false;
  }
}

function loadData() {
  const url = CONFIG.SERVER_URL + '/api/sheets?key=' + CONFIG.API_KEY;

  try {
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true,
      headers: { 'Accept': 'application/json' }
    });

    const code = response.getResponseCode();

    if (code === 200) {
      const result = JSON.parse(response.getContentText());

      if (result.success && result.data) {
        Logger.log('✅ Loaded ' + result.tokenCount + ' tokens (cache age: ' + result.cacheAge + 's)');

        const props = PropertiesService.getScriptProperties();
        props.setProperty('CACHED_DATA', JSON.stringify(result.data));
        props.setProperty('CACHED_SECTORS', JSON.stringify(result.sectors));
        props.setProperty('SECTOR_TOKENS', JSON.stringify(result.sectorTokens));

        return {
          dataMap: result.data,
          sectorStats: result.sectors,
          sectorTokens: result.sectorTokens,
          timestamp: result.timestamp,
          cacheAge: result.cacheAge
        };
      }
    } else if (code === 401) {
      Logger.log('❌ Invalid API key');
    } else if (code === 503) {
      Logger.log('⚠️ Server cache not ready, retrying...');
      Utilities.sleep(5000);
      return loadData();
    } else {
      Logger.log('❌ Server error: ' + code);
    }

    return null;
  } catch (e) {
    Logger.log('❌ Fetch error: ' + e.message);
    return null;
  }
}

// ============================================================================
// DASHBOARD
// ============================================================================

function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  sheet.clear();

  const serverData = loadData();
  if (!serverData || !serverData.dataMap) {
    sheet.getRange('A1').setValue('❌ Ошибка загрузки данных с сервера');
    return;
  }

  const { dataMap, sectorStats, sectorTokens } = serverData;

  const allSectorStats = [];
  let row = 1;
  const sectorNames = Object.keys(sectorTokens);

  for (let i = 0; i < sectorNames.length; i += 2) {
    const r1 = writeSectorBlock(sheet, row, 1, sectorNames[i], dataMap, sectorTokens);
    allSectorStats.push(r1.stats);

    let r2row = row;
    if (sectorNames[i + 1]) {
      const r2 = writeSectorBlock(sheet, row, 10, sectorNames[i + 1], dataMap, sectorTokens);
      allSectorStats.push(r2.stats);
      r2row = r2.endRow;
    }
    row = Math.max(r1.endRow, r2row) + 2;
  }

  const summaryResult = writeSummaryBlock(sheet, 1, 19, allSectorStats);

  // ==================== ПОРТФЕЛЬ (под "Обзор секторов") ====================
  writePortfolioBlock(sheet, summaryResult.endRow + 3, 19, dataMap);

  const ts = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  const cacheInfo = serverData.cacheAge ? ' (cache: ' + serverData.cacheAge + 's)' : '';
  sheet.getRange(row, 1).setValue('🔄 Обновлено: ' + ts + ' MSK' + cacheInfo).setFontColor('#888').setFontSize(9);

  sheet.setColumnWidth(9, 15);
  sheet.setColumnWidth(18, 15);

  Logger.log('Dashboard updated: ' + ts);
}

// ============================================================================
// ПОРТФЕЛЬ — мини-таблица с отслеживаемыми токенами
// ============================================================================

function writePortfolioBlock(sheet, startRow, startCol, dataMap) {
  const rows = [];
  const bgColors = [];
  const fontColors = [];

  // Заголовок
  rows.push(['💼 ПОРТФЕЛЬ', '', '', '']);
  bgColors.push(['#1a1a2e', '#1a1a2e', '#1a1a2e', '#1a1a2e']);
  fontColors.push(['#FFD700', '#FFD700', '#FFD700', '#FFD700']);

  // Шапка
  rows.push(['Token', 'Price', '24h', '7d']);
  bgColors.push(['#2C3E50', '#2C3E50', '#2C3E50', '#2C3E50']);
  fontColors.push(['#FFF', '#FFF', '#FFF', '#FFF']);

  // Данные токенов
  let totalChange24 = 0, cnt = 0;

  PORTFOLIO_TOKENS.forEach(id => {
    const c = dataMap[id];
    if (c) {
      const p24 = c.change_24h;
      const p7d = c.change_7d;

      rows.push([
        c.symbol,
        formatPrice(c.price),
        p24 != null ? (p24 >= 0 ? '+' : '') + p24.toFixed(1) + '%' : 'N/A',
        p7d != null ? (p7d >= 0 ? '+' : '') + p7d.toFixed(1) + '%' : 'N/A'
      ]);

      // Цвет строки по 24h
      const rowBg = getHeatmapColor(p24 || 0);
      bgColors.push([rowBg, rowBg, rowBg, rowBg]);

      const c24 = p24 > 0 ? '#16A34A' : p24 < 0 ? '#DC2626' : '#333';
      const c7d = p7d > 0 ? '#16A34A' : p7d < 0 ? '#DC2626' : '#333';
      fontColors.push(['#000', '#000', c24, c7d]);

      if (p24 != null) { totalChange24 += p24; cnt++; }
    } else {
      // Токен не найден в данных
      rows.push([id.substring(0, 8), 'N/A', 'N/A', 'N/A']);
      bgColors.push(['#F3F4F6', '#F3F4F6', '#F3F4F6', '#F3F4F6']);
      fontColors.push(['#999', '#999', '#999', '#999']);
    }
  });

  // Итого портфель
  const avgChange = cnt > 0 ? totalChange24 / cnt : 0;
  rows.push(['📊 AVG', '', (avgChange >= 0 ? '+' : '') + avgChange.toFixed(1) + '%', '']);
  const avgBg = avgChange >= 0 ? '#22C55E' : '#EF4444';
  bgColors.push([avgBg, avgBg, avgBg, avgBg]);
  fontColors.push(['#FFF', '#FFF', '#FFF', '#FFF']);

  // Записываем
  const range = sheet.getRange(startRow, startCol, rows.length, 4);
  range.setValues(rows);
  range.setBackgrounds(bgColors);
  range.setFontColors(fontColors);
  range.setFontSize(9);
  range.setFontWeight('bold');
  range.setVerticalAlignment('middle');

  // Merge заголовка
  sheet.getRange(startRow, startCol, 1, 4).merge().setHorizontalAlignment('center').setFontSize(11);

  // Рамка
  range.setBorder(true, true, true, true, true, true, '#1a1a2e', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Ширина колонок
  sheet.setColumnWidth(startCol, 60);     // Token
  sheet.setColumnWidth(startCol + 1, 75); // Price
  sheet.setColumnWidth(startCol + 2, 55); // 24h
  sheet.setColumnWidth(startCol + 3, 55); // 7d

  return { endRow: startRow + rows.length };
}

function writeSectorBlock(sheet, startRow, startCol, sectorName, dataMap, sectorTokens) {
  const headerColor = SECTOR_COLORS[sectorName] || '#CCCCCC';
  const lightColor = lightenColor(headerColor, 0.6);
  const tokens = sectorTokens[sectorName] || [];

  const coins = tokens
    .filter(id => dataMap[id])
    .map(id => {
      const c = dataMap[id];
      return { id, c, p: c.change_24h != null ? c.change_24h : -9999 };
    })
    .sort((a, b) => b.p - a.p);

  let totalMcap = 0, sum24 = 0, sum7d = 0, sum30d = 0, cnt = 0;
  let best24h = { symbol: '-', value: -Infinity };

  coins.forEach(item => {
    const c = item.c;
    totalMcap += c.market_cap || 0;
    const p = c.change_24h;
    if (p != null) {
      sum24 += p; cnt++;
      if (p > best24h.value) best24h = { symbol: c.symbol, value: p };
    }
    if (c.change_7d != null) sum7d += c.change_7d;
    if (c.change_30d != null) sum30d += c.change_30d;
  });

  const avg24h = cnt > 0 ? sum24 / cnt : 0;
  const avg7d = cnt > 0 ? sum7d / cnt : 0;
  const avg30d = cnt > 0 ? sum30d / cnt : 0;

  const rows = [];
  const bgColors = [];
  const fontColors = [];
  const fontWeights = [];

  rows.push([sectorName, '', '', '', '', '', '', '']);
  bgColors.push(Array(8).fill(headerColor));
  fontColors.push(Array(8).fill('#000'));
  fontWeights.push(Array(8).fill('bold'));

  rows.push(['#', 'Token', 'Symbol', 'Price', '24h %', '7d %', '30d %', 'MCap']);
  bgColors.push(Array(8).fill('#F0F0F0'));
  fontColors.push(Array(8).fill('#000'));
  fontWeights.push(Array(8).fill('bold'));

  coins.forEach((item, idx) => {
    const c = item.c;
    const p24 = c.change_24h;
    const p7d = c.change_7d;
    const p30d = c.change_30d;

    rows.push([
      idx + 1,
      truncateName(c.name, 16),
      c.symbol,
      formatPrice(c.price),
      p24 != null ? p24.toFixed(2) + '%' : 'N/A',
      p7d != null ? p7d.toFixed(2) + '%' : 'N/A',
      p30d != null ? p30d.toFixed(2) + '%' : 'N/A',
      formatMarketCap(c.market_cap)
    ]);

    const rowBg = getHeatmapColor(p24 || 0);
    bgColors.push([lightColor, rowBg, rowBg, rowBg, rowBg, rowBg, rowBg, rowBg]);

    const c24 = p24 > 0 ? '#16A34A' : p24 < 0 ? '#DC2626' : '#666';
    const c7d = p7d > 0 ? '#16A34A' : p7d < 0 ? '#DC2626' : '#666';
    const c30d = p30d > 0 ? '#16A34A' : p30d < 0 ? '#DC2626' : '#666';
    fontColors.push(['#000', '#000', '#000', '#000', c24, c7d, c30d, '#000']);

    const w24 = (p24 > 0 || p24 < 0) ? 'bold' : 'normal';
    const w7d = (p7d > 0 || p7d < 0) ? 'bold' : 'normal';
    const w30d = (p30d > 0 || p30d < 0) ? 'bold' : 'normal';
    fontWeights.push(['normal', 'normal', 'normal', 'normal', w24, w7d, w30d, 'normal']);
  });

  rows.push(['', 'SECTOR AVG', '', '', avg24h.toFixed(2) + '%', avg7d.toFixed(2) + '%', avg30d.toFixed(2) + '%', '']);
  bgColors.push([lightColor, '#E8E8E8', '#E8E8E8', '#E8E8E8', '#E8E8E8', '#E8E8E8', '#E8E8E8', '#E8E8E8']);
  const avgC24 = avg24h > 0 ? '#16A34A' : avg24h < 0 ? '#DC2626' : '#666';
  const avgC7d = avg7d > 0 ? '#16A34A' : avg7d < 0 ? '#DC2626' : '#666';
  const avgC30d = avg30d > 0 ? '#16A34A' : avg30d < 0 ? '#DC2626' : '#666';
  fontColors.push(['#000', '#000', '#000', '#000', avgC24, avgC7d, avgC30d, '#000']);
  fontWeights.push(Array(8).fill('bold'));

  const range = sheet.getRange(startRow, startCol, rows.length, 8);
  range.setValues(rows);
  range.setBackgrounds(bgColors);
  range.setFontColors(fontColors);
  range.setFontWeights(fontWeights);
  range.setFontSize(9);
  range.setVerticalAlignment('middle');

  sheet.getRange(startRow, startCol, 1, 8).merge().setHorizontalAlignment('center').setFontSize(11);

  range.setBorder(true, true, true, true, true, true, '#999', SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(startRow, startCol, rows.length, 8).setBorder(true, true, true, true, null, null, '#000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  const widths = [24, 115, 55, 70, 58, 58, 58, 75];
  for (let i = 0; i < 8; i++) sheet.setColumnWidth(startCol + i, widths[i]);

  return {
    endRow: startRow + rows.length,
    stats: {
      name: sectorName,
      color: headerColor,
      mcap: totalMcap,
      avg24h: avg24h,
      avg7d: avg7d,
      avg30d: avg30d,
      best: best24h.value > -Infinity ? best24h : null
    }
  };
}

function writeSummaryBlock(sheet, startRow, startCol, sectorStats) {
  const sorted = [...sectorStats].sort((a, b) => (b.avg24h || 0) - (a.avg24h || 0));

  let totalMcap = 0, sum24 = 0, sum7d = 0, sum30d = 0, cnt = 0;
  sorted.forEach(s => {
    totalMcap += s.mcap || 0;
    if (s.avg24h != null) { sum24 += s.avg24h; sum7d += s.avg7d || 0; sum30d += s.avg30d || 0; cnt++; }
  });

  const avgAll24 = cnt > 0 ? sum24 / cnt : 0;
  const avgAll7d = cnt > 0 ? sum7d / cnt : 0;
  const avgAll30d = cnt > 0 ? sum30d / cnt : 0;

  const rows = [];
  const bgColors = [];
  const fontColors = [];

  rows.push(['📊 ОБЗОР СЕКТОРОВ', '', '', '', '', '', '']);
  bgColors.push(Array(7).fill('#2C3E50'));
  fontColors.push(Array(7).fill('#FFF'));

  rows.push(['#', 'Sector', 'MCap', '24h %', '7d %', '30d %', 'Top Gainer']);
  bgColors.push(Array(7).fill('#34495E'));
  fontColors.push(Array(7).fill('#FFF'));

  sorted.forEach((s, i) => {
    const topText = s.best ? s.best.symbol + ' +' + s.best.value.toFixed(1) + '%' : '-';
    rows.push([
      i + 1,
      s.name,
      formatMarketCap(s.mcap),
      (s.avg24h >= 0 ? '+' : '') + s.avg24h.toFixed(1) + '%',
      (s.avg7d >= 0 ? '+' : '') + s.avg7d.toFixed(1) + '%',
      (s.avg30d >= 0 ? '+' : '') + s.avg30d.toFixed(1) + '%',
      topText
    ]);

    const rowBg = getHeatmapColor(s.avg24h || 0);
    bgColors.push(Array(7).fill(rowBg));

    const c24 = s.avg24h > 0 ? '#16A34A' : s.avg24h < 0 ? '#DC2626' : '#666';
    const c7d = s.avg7d > 0 ? '#16A34A' : s.avg7d < 0 ? '#DC2626' : '#666';
    const c30d = s.avg30d > 0 ? '#16A34A' : s.avg30d < 0 ? '#DC2626' : '#666';
    fontColors.push(['#000', '#000', '#000', c24, c7d, c30d, '#16A34A']);
  });

  rows.push(['', '📈 ИТОГО', formatMarketCap(totalMcap),
    (avgAll24 >= 0 ? '+' : '') + avgAll24.toFixed(1) + '%',
    (avgAll7d >= 0 ? '+' : '') + avgAll7d.toFixed(1) + '%',
    (avgAll30d >= 0 ? '+' : '') + avgAll30d.toFixed(1) + '%', '']);
  bgColors.push(Array(7).fill('#2C3E50'));
  const tc24 = avgAll24 >= 0 ? '#4ADE80' : '#F87171';
  const tc7d = avgAll7d >= 0 ? '#4ADE80' : '#F87171';
  const tc30d = avgAll30d >= 0 ? '#4ADE80' : '#F87171';
  fontColors.push(['#FFF', '#FFF', '#FFF', tc24, tc7d, tc30d, '#FFF']);

  const range = sheet.getRange(startRow, startCol, rows.length, 7);
  range.setValues(rows);
  range.setBackgrounds(bgColors);
  range.setFontColors(fontColors);
  range.setFontSize(9);

  sheet.getRange(startRow, startCol, 1, 7).merge().setHorizontalAlignment('center').setFontWeight('bold').setFontSize(11);
  sheet.getRange(startRow + 1, startCol, 1, 7).setFontWeight('bold');
  sheet.getRange(startRow + rows.length - 1, startCol, 1, 7).setFontWeight('bold');

  range.setBorder(true, true, true, true, true, true, '#2C3E50', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  const widths = [22, 105, 65, 55, 55, 55, 100];
  for (let i = 0; i < 7; i++) sheet.setColumnWidth(startCol + i, widths[i]);

  return { endRow: startRow + rows.length };
}

// ============================================================================
// RATING
// ============================================================================

function updateRating() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.RATING_SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(CONFIG.RATING_SHEET_NAME);

  let dataMap = null;
  let sectorTokens = null;

  try {
    const props = PropertiesService.getScriptProperties();
    const cachedData = props.getProperty('CACHED_DATA');
    const cachedSectors = props.getProperty('SECTOR_TOKENS');
    if (cachedData) dataMap = JSON.parse(cachedData);
    if (cachedSectors) sectorTokens = JSON.parse(cachedSectors);
  } catch(e) {}

  if (!dataMap || !sectorTokens) {
    const serverData = loadData();
    if (!serverData) {
      sheet.getRange('A1').setValue('❌ Ошибка: сначала обновите Dashboard');
      return;
    }
    dataMap = serverData.dataMap;
    sectorTokens = serverData.sectorTokens;
  }

  let ratingData = loadRatingData(sheet);
  const newScores = calculateScores(dataMap, sectorTokens);
  ratingData = mergeRating(ratingData, newScores);

  writeRatingSheet(sheet, ratingData, dataMap, sectorTokens);

  Logger.log('Rating updated');
}

function loadRatingData(sheet) {
  const data = {};
  const lastRow = sheet.getLastRow();
  if (lastRow < 3) return data;

  const values = sheet.getRange(3, 1, lastRow - 2, 15).getValues();
  values.forEach(r => {
    if (r[0]) {
      data[r[0]] = {
        symbol: r[1], name: r[2], sector: r[3],
        totalScore: r[4] || 0, updates: r[5] || 0,
        top1Count: r[6] || 0, top3Count: r[7] || 0,
        greenDays: r[8] || 0, moonDays: r[9] || 0,
        avgGain: r[10] || 0, bestGain: r[11] || 0,
        lastScore: r[12] || 0, trend: r[13] || 'NEW'
      };
    }
  });
  return data;
}

function calculateScores(dataMap, sectorTokens) {
  const scores = {};

  const sectorAvgs = {};
  let marketSum = 0, marketCnt = 0;

  Object.entries(sectorTokens).forEach(([name, tokens]) => {
    let sum = 0, cnt = 0;
    tokens.forEach(id => {
      const c = dataMap[id];
      if (c && c.change_24h != null) {
        sum += c.change_24h;
        cnt++;
      }
    });
    sectorAvgs[name] = cnt > 0 ? sum / cnt : 0;
    marketSum += sum;
    marketCnt += cnt;
  });

  const marketAvg = marketCnt > 0 ? marketSum / marketCnt : 0;

  const all = Object.keys(dataMap)
    .filter(id => dataMap[id].change_24h != null)
    .map(id => ({ id, p: dataMap[id].change_24h || 0, c: dataMap[id] }))
    .sort((a, b) => b.p - a.p);

  const gRank = {};
  all.forEach((t, i) => { gRank[t.id] = i + 1; });

  Object.entries(sectorTokens).forEach(([sectorName, tokens]) => {
    const sectorAvg = sectorAvgs[sectorName] || 0;

    const sCoins = tokens
      .filter(id => dataMap[id])
      .map(id => ({ id, p: dataMap[id].change_24h || 0, c: dataMap[id] }))
      .sort((a, b) => b.p - a.p);

    sCoins.forEach((item, sRank) => {
      let score = 0;
      const p = item.p;
      const g = gRank[item.id];

      if (sRank === 0) score += SCORING.TOP1_SECTOR;
      else if (sRank === 1) score += SCORING.TOP2_SECTOR;
      else if (sRank === 2) score += SCORING.TOP3_SECTOR;

      if (g === 1) score += SCORING.TOP1_GLOBAL;
      else if (g <= 3) score += SCORING.TOP3_GLOBAL;
      else if (g <= 10) score += SCORING.TOP10_GLOBAL;

      if (p > sectorAvg && p > 0) score += SCORING.BEAT_SECTOR_AVG;
      if (p > marketAvg && p > 0) score += SCORING.BEAT_MARKET_AVG;

      if (p >= 15) score += SCORING.MOON_DAY;
      else if (p >= 5) score += SCORING.STRONG_GREEN;
      else if (p > 0) score += SCORING.GREEN_DAY;

      scores[item.id] = {
        symbol: item.c.symbol,
        name: item.c.name || item.id,
        sector: sectorName,
        score, p, sRank: sRank + 1, gRank: g,
        isMoon: p >= 15, isGreen: p > 0
      };
    });
  });

  return scores;
}

function mergeRating(existing, newScores) {
  const merged = { ...existing };

  Object.keys(newScores).forEach(id => {
    const n = newScores[id];
    if (!merged[id]) {
      merged[id] = {
        symbol: n.symbol, name: n.name, sector: n.sector,
        totalScore: n.score, updates: 1,
        top1Count: n.sRank === 1 ? 1 : 0,
        top3Count: n.sRank <= 3 ? 1 : 0,
        greenDays: n.isGreen ? 1 : 0,
        moonDays: n.isMoon ? 1 : 0,
        avgGain: n.p, bestGain: n.p,
        lastScore: n.score, trend: 'NEW'
      };
    } else {
      const o = merged[id];
      o.totalScore += n.score;
      o.updates++;
      o.top1Count += n.sRank === 1 ? 1 : 0;
      o.top3Count += n.sRank <= 3 ? 1 : 0;
      o.greenDays += n.isGreen ? 1 : 0;
      o.moonDays += n.isMoon ? 1 : 0;
      o.avgGain = ((o.avgGain * (o.updates - 1)) + n.p) / o.updates;
      o.bestGain = Math.max(o.bestGain, n.p);
      o.lastScore = n.score;
      o.trend = n.score > 5 ? 'HOT 🔥' : n.score > 2 ? 'UP ⬆️' : n.score > 0 ? 'STABLE ➡️' : 'DOWN ⬇️';
      o.sector = n.sector;
    }
  });

  return merged;
}

// ============================================================================
// ГЕНЕРАЦИЯ РЕКОМЕНДАЦИЙ
// ============================================================================

function generateRecommendations(ratingData, dataMap, sectorTokens) {
  const recommendations = [];

  // 1. Определяем топ растущие секторы (по текущему 24h)
  const sectorPerf = {};
  Object.entries(sectorTokens).forEach(([name, tokens]) => {
    let sum = 0, cnt = 0;
    tokens.forEach(id => {
      const c = dataMap[id];
      if (c && c.change_24h != null) { sum += c.change_24h; cnt++; }
    });
    sectorPerf[name] = cnt > 0 ? sum / cnt : 0;
  });

  const hotSectors = Object.entries(sectorPerf)
    .filter(([_, avg]) => avg > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // 2. Находим недооценённые токены в горячих секторах
  // (высокий Alpha, но текущий 24h ниже среднего сектора)
  const allItems = Object.keys(ratingData)
    .map(id => ({ id, ...ratingData[id], alpha: calcAlpha(ratingData[id]), current24h: dataMap[id]?.change_24h || 0 }));

  hotSectors.forEach(([sectorName, sectorAvg]) => {
    const sectorTokensList = allItems
      .filter(t => t.sector === sectorName && t.alpha >= 50)
      .filter(t => t.current24h < sectorAvg && t.current24h >= -2) // отстаёт, но не падает сильно
      .sort((a, b) => b.alpha - a.alpha)
      .slice(0, 3);

    if (sectorTokensList.length > 0) {
      recommendations.push({
        type: 'UNDERVALUED_IN_HOT',
        icon: '🎯',
        sector: sectorName,
        sectorGain: sectorAvg,
        tokens: sectorTokensList.map(t => ({ symbol: t.symbol, alpha: t.alpha, current: t.current24h }))
      });
    }
  });

  // 3. Токены с высоким Alpha которые сейчас в минусе (потенциал отскока)
  const bounceCandiates = allItems
    .filter(t => t.alpha >= 60 && t.current24h < -3 && t.current24h > -15)
    .sort((a, b) => b.alpha - a.alpha)
    .slice(0, 5);

  if (bounceCandiates.length > 0) {
    recommendations.push({
      type: 'BOUNCE_POTENTIAL',
      icon: '🔄',
      title: 'Сильные активы на коррекции',
      tokens: bounceCandiates.map(t => ({ symbol: t.symbol, alpha: t.alpha, current: t.current24h, sector: t.sector }))
    });
  }

  // 4. Текущие лидеры роста с высоким Alpha (подтверждённый momentum)
  const momentumLeaders = allItems
    .filter(t => t.alpha >= 70 && t.current24h >= 5)
    .sort((a, b) => b.current24h - a.current24h)
    .slice(0, 5);

  if (momentumLeaders.length > 0) {
    recommendations.push({
      type: 'MOMENTUM',
      icon: '🚀',
      title: 'Подтверждённый momentum',
      tokens: momentumLeaders.map(t => ({ symbol: t.symbol, alpha: t.alpha, current: t.current24h, sector: t.sector }))
    });
  }

  // 5. Sleeping giants — высокий Alpha, но долго без движения
  const sleepers = allItems
    .filter(t => t.alpha >= 65 && Math.abs(t.current24h) < 1 && t.updates >= 5)
    .sort((a, b) => b.alpha - a.alpha)
    .slice(0, 5);

  if (sleepers.length > 0) {
    recommendations.push({
      type: 'SLEEPERS',
      icon: '😴',
      title: 'Спящие гиганты',
      tokens: sleepers.map(t => ({ symbol: t.symbol, alpha: t.alpha, sector: t.sector }))
    });
  }

  return recommendations;
}

function writeRatingSheet(sheet, ratingData, dataMap, sectorTokens) {
  sheet.clear();

  if (sheet.getMaxColumns() < 35) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 35 - sheet.getMaxColumns());
  }

  const allItems = Object.keys(ratingData)
    .map(id => ({ id, ...ratingData[id], alpha: calcAlpha(ratingData[id]) }));

  if (allItems.length === 0) {
    sheet.getRange(1, 1).setValue('⚠️ Нет данных. Сначала обновите Dashboard.');
    return;
  }

  const top20Alpha = [...allItems].sort((a, b) => b.alpha - a.alpha).slice(0, 20);

  const bySector = {};
  allItems.forEach(item => {
    const s = item.sector || 'Other';
    if (!bySector[s]) bySector[s] = { tokens: [], totalScore: 0 };
    bySector[s].tokens.push(item);
    bySector[s].totalScore += item.totalScore;
  });

  const sortedSectors = Object.keys(bySector)
    .sort((a, b) => bySector[b].totalScore - bySector[a].totalScore);

  const sectorLeaders = sortedSectors.map(s => {
    const top = [...bySector[s].tokens].sort((a, b) => b.totalScore - a.totalScore)[0];
    return { sector: s, ...top, sectorTotal: bySector[s].totalScore };
  });

  // ==================== ГЕНЕРИРУЕМ РЕКОМЕНДАЦИИ ====================
  const recommendations = generateRecommendations(ratingData, dataMap, sectorTokens);

  // ==================== ШИРИНА КОЛОНОК ====================
  const leftWidths = [25, 50, 95, 40, 40, 55, 70];
  for (let i = 0; i < 7; i++) sheet.setColumnWidth(i + 1, leftWidths[i]);
  sheet.setColumnWidth(8, 15);
  for (let i = 0; i < 7; i++) sheet.setColumnWidth(i + 9, leftWidths[i]);
  sheet.setColumnWidth(16, 20);
  sheet.setColumnWidth(17, 70);
  sheet.setColumnWidth(18, 60);
  sheet.setColumnWidth(19, 180);
  sheet.setColumnWidth(20, 15);
  sheet.setColumnWidth(21, 30);
  sheet.setColumnWidth(22, 90);
  sheet.setColumnWidth(23, 55);
  sheet.setColumnWidth(24, 45);
  sheet.setColumnWidth(25, 60);
  sheet.setColumnWidth(26, 30);

  // Колонки для рекомендаций
  sheet.setColumnWidth(27, 15);
  sheet.setColumnWidth(28, 55);
  sheet.setColumnWidth(29, 45);
  sheet.setColumnWidth(30, 50);
  sheet.setColumnWidth(31, 80);

  let row = 1;

  // ==================== ЗАГОЛОВОК ====================
  sheet.getRange(row, 1, 1, 15).merge()
    .setValue('📊 РЕЙТИНГ ПО СЕКТОРАМ')
    .setBackground('#1a1a2e').setFontColor('#FFD700').setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center');

  sheet.getRange(row, 17, 1, 3).merge()
    .setValue('🎯 ALPHA SCORE')
    .setBackground('#1a1a2e').setFontColor('#FFD700').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');

  sheet.getRange(row, 21, 1, 6).merge()
    .setValue('🥇 ЛИДЕРЫ СЕКТОРОВ')
    .setBackground('#1a1a2e').setFontColor('#FFD700').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');

  // Рекомендации заголовок
  sheet.getRange(row, 28, 1, 4).merge()
    .setValue('🚀 КУДА ЗАХОДИТЬ')
    .setBackground('#1a1a2e').setFontColor('#00FF7F').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  row++;

  // ==================== БЛОК РЕКОМЕНДАЦИЙ ====================
  let recRow = row;

  recommendations.forEach(rec => {
    if (rec.type === 'UNDERVALUED_IN_HOT') {
      sheet.getRange(recRow, 28, 1, 4).merge()
        .setValue(rec.icon + ' ' + rec.sector + ' +' + rec.sectorGain.toFixed(1) + '% — недооценённые:')
        .setBackground('#065F46').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
      recRow++;

      rec.tokens.forEach(t => {
        sheet.getRange(recRow, 28, 1, 4).setValues([[t.symbol, 'α' + t.alpha, (t.current >= 0 ? '+' : '') + t.current.toFixed(1) + '%', '← отстаёт']])
          .setBackground('#D1FAE5').setFontSize(8);
        sheet.getRange(recRow, 28).setFontWeight('bold');
        recRow++;
      });
      recRow++;
    }

    if (rec.type === 'BOUNCE_POTENTIAL') {
      sheet.getRange(recRow, 28, 1, 4).merge()
        .setValue(rec.icon + ' ' + rec.title)
        .setBackground('#7C2D12').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
      recRow++;

      rec.tokens.forEach(t => {
        sheet.getRange(recRow, 28, 1, 4).setValues([[t.symbol, 'α' + t.alpha, t.current.toFixed(1) + '%', t.sector]])
          .setBackground('#FED7AA').setFontSize(8);
        sheet.getRange(recRow, 28).setFontWeight('bold');
        sheet.getRange(recRow, 30).setFontColor('#DC2626');
        recRow++;
      });
      recRow++;
    }

    if (rec.type === 'MOMENTUM') {
      sheet.getRange(recRow, 28, 1, 4).merge()
        .setValue(rec.icon + ' ' + rec.title)
        .setBackground('#14532D').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
      recRow++;

      rec.tokens.forEach(t => {
        sheet.getRange(recRow, 28, 1, 4).setValues([[t.symbol, 'α' + t.alpha, '+' + t.current.toFixed(1) + '%', t.sector]])
          .setBackground('#BBF7D0').setFontSize(8);
        sheet.getRange(recRow, 28).setFontWeight('bold');
        sheet.getRange(recRow, 30).setFontColor('#16A34A').setFontWeight('bold');
        recRow++;
      });
      recRow++;
    }

    if (rec.type === 'SLEEPERS') {
      sheet.getRange(recRow, 28, 1, 4).merge()
        .setValue(rec.icon + ' ' + rec.title)
        .setBackground('#1E3A5F').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
      recRow++;

      rec.tokens.forEach(t => {
        sheet.getRange(recRow, 28, 1, 4).setValues([[t.symbol, 'α' + t.alpha, '~0%', t.sector]])
          .setBackground('#DBEAFE').setFontSize(8);
        sheet.getRange(recRow, 28).setFontWeight('bold');
        recRow++;
      });
      recRow++;
    }
  });

  // ==================== ALPHA SCORE — расшифровка ====================
  let memoRow = row;

  // Заголовок
  sheet.getRange(memoRow, 17, 1, 3).merge()
    .setValue('📊 ALPHA SCORE')
    .setBackground('#1a1a2e').setFontColor('#00CED1').setFontWeight('bold')
    .setFontSize(11).setHorizontalAlignment('center');
  memoRow++;

  // Главное определение
  sheet.getRange(memoRow, 17, 1, 3).merge()
    .setValue('Комплексная оценка актива (0-100)')
    .setBackground('#2C3E50').setFontColor('#FFF').setFontSize(9).setHorizontalAlignment('center');
  memoRow++;

  // Пустая строка
  sheet.getRange(memoRow, 17, 1, 3).merge().setBackground('#FFFFFF');
  memoRow++;

  // Заголовок компонентов
  sheet.getRange(memoRow, 17, 1, 3).setValues([['Компонент', 'Тип', 'Описание']])
    .setBackground('#374151').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
  memoRow++;

  // Компоненты Alpha Score
  const components = [
    ['Top3', 'баллы', 'Частота в топ-3 сектора'],
    ['GreenDays', 'баллы', 'Дни роста'],
    ['AvgGain', '%', 'Средняя доходность'],
    ['MoonDays', 'баллы', 'Дни +15% и выше']
  ];
  components.forEach((comp, i) => {
    const bg = i % 2 === 0 ? '#F3F4F6' : '#E5E7EB';
    sheet.getRange(memoRow, 17, 1, 3).setValues([comp]).setBackground(bg).setFontSize(8);
    sheet.getRange(memoRow, 17).setFontWeight('bold');
    memoRow++;
  });

  // Пустая строка
  sheet.getRange(memoRow, 17, 1, 3).merge().setBackground('#FFFFFF');
  memoRow++;

  // Заголовок уровней
  sheet.getRange(memoRow, 17, 1, 3).setValues([['Уровень', 'Статус', 'Действие']])
    .setBackground('#374151').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
  memoRow++;

  // Уровни Alpha
  const levels = [
    ['80-100', '🟢 TOP', 'Покупать на откатах', '#166534', '#DCFCE7'],
    ['60-79', '🟢 Strong', 'Держать/докупать', '#15803D', '#D1FAE5'],
    ['40-59', '🟡 Mid', 'Наблюдать', '#A16207', '#FEF9C3'],
    ['20-39', '🟠 Weak', 'Избегать', '#C2410C', '#FED7AA'],
    ['0-19', '🔴 Poor', 'Не покупать', '#B91C1C', '#FEE2E2']
  ];
  levels.forEach(level => {
    sheet.getRange(memoRow, 17, 1, 3).setValues([[level[0], level[1], level[2]]])
      .setBackground(level[4]).setFontSize(8);
    sheet.getRange(memoRow, 17).setFontWeight('bold').setFontColor(level[3]);
    sheet.getRange(memoRow, 18).setFontWeight('bold');
    memoRow++;
  });

  // ==================== ЛИДЕРЫ СЕКТОРОВ ====================
  let leaderRow = row;
  sheet.getRange(leaderRow, 21, 1, 6).setValues([['#', 'Сектор', 'Лидер', 'Alpha', 'Gain', '']])
    .setBackground('#2C3E50').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
  leaderRow++;

  sectorLeaders.forEach((item, i) => {
    const sectorColor = SECTOR_COLORS[item.sector] || '#CCCCCC';
    const alpha = (item.alpha != null && !isNaN(item.alpha)) ? item.alpha : 0;
    sheet.getRange(leaderRow, 21, 1, 6).setValues([[
      i + 1, truncateName(item.sector, 10), item.symbol || '?', alpha,
      formatGain(item.avgGain), ''
    ]]).setBackground(lightenColor(sectorColor, 0.75)).setFontSize(8);
    sheet.getRange(leaderRow, 22).setBackground(sectorColor).setFontWeight('bold');
    leaderRow++;
  });

  // ==================== СЕКТОРЫ В 2 СТОЛБЦА ====================
  const headers = ['#', 'Sym', 'Name', 'Alpha', 'Scr', 'AvgGain', 'Trend'];

  let currentRow = row;

  for (let i = 0; i < sortedSectors.length; i += 2) {
    const leftSector = sortedSectors[i];
    const rightSector = sortedSectors[i + 1];

    const leftData = bySector[leftSector];
    const leftColor = SECTOR_COLORS[leftSector] || '#CCCCCC';
    const leftTokens = [...leftData.tokens].sort((a, b) => b.avgGain - a.avgGain);

    let rightTokens = [];
    let rightColor = '#CCCCCC';
    if (rightSector && bySector[rightSector]) {
      rightColor = SECTOR_COLORS[rightSector] || '#CCCCCC';
      rightTokens = [...bySector[rightSector].tokens].sort((a, b) => b.avgGain - a.avgGain);
    }

    sheet.getRange(currentRow, 1, 1, 7).merge()
      .setValue(leftSector).setBackground(leftColor).setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');
    if (rightSector && bySector[rightSector]) {
      sheet.getRange(currentRow, 9, 1, 7).merge()
        .setValue(rightSector).setBackground(rightColor).setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center');
    }
    currentRow++;

    sheet.getRange(currentRow, 1, 1, 7).setValues([headers]).setBackground('#E5E7EB').setFontWeight('bold').setFontSize(7);
    if (rightSector && bySector[rightSector]) {
      sheet.getRange(currentRow, 9, 1, 7).setValues([headers]).setBackground('#E5E7EB').setFontWeight('bold').setFontSize(7);
    }
    currentRow++;

    const maxTokens = Math.max(leftTokens.length, rightTokens.length);

    for (let t = 0; t < maxTokens; t++) {
      if (t < leftTokens.length) {
        const item = leftTokens[t];
        const bg = t === 0 ? lightenColor(leftColor, 0.5) : lightenColor(leftColor, 0.88);
        const alpha = (item.alpha != null && !isNaN(item.alpha)) ? item.alpha : 0;
        const score = (item.totalScore != null && !isNaN(item.totalScore)) ? item.totalScore : 0;
        sheet.getRange(currentRow, 1, 1, 7).setValues([[
          t + 1, item.symbol || '?', truncateName(item.name, 11), alpha, score,
          formatGain(item.avgGain), item.trend || 'NEW'
        ]]).setBackground(bg).setFontSize(7);
      }

      if (t < rightTokens.length) {
        const item = rightTokens[t];
        const bg = t === 0 ? lightenColor(rightColor, 0.5) : lightenColor(rightColor, 0.88);
        const alpha = (item.alpha != null && !isNaN(item.alpha)) ? item.alpha : 0;
        const score = (item.totalScore != null && !isNaN(item.totalScore)) ? item.totalScore : 0;
        sheet.getRange(currentRow, 9, 1, 7).setValues([[
          t + 1, item.symbol || '?', truncateName(item.name, 11), alpha, score,
          formatGain(item.avgGain), item.trend || 'NEW'
        ]]).setBackground(bg).setFontSize(7);
      }

      currentRow++;
    }

    currentRow++;
  }

  let leftRow = currentRow;
  let rightRow = currentRow;

  // ==================== ТОП-20 АЛЬФА ====================
  let sideRow = memoRow + 2;

  sheet.getRange(sideRow, 17, 1, 3).merge()
    .setValue('🏆 ТОП-20 АЛЬФА')
    .setBackground('#1a1a2e').setFontColor('#FFD700').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center');
  sideRow++;

  sheet.getRange(sideRow, 17, 1, 3).setValues([['#', 'Symbol', 'Alpha']])
    .setBackground('#2C3E50').setFontColor('#FFF').setFontWeight('bold').setFontSize(8);
  sideRow++;

  top20Alpha.forEach((item, i) => {
    const ratio = i / 19;
    const bg = ratio < 0.25 ? '#22C55E' : ratio < 0.5 ? '#86EFAC' : ratio < 0.75 ? '#FEF08A' : '#FECACA';
    const alpha = (item.alpha != null && !isNaN(item.alpha)) ? item.alpha : 0;
    sheet.getRange(sideRow, 17, 1, 3).setValues([[
      i + 1, item.symbol || 'N/A', alpha
    ]]).setBackground(bg).setFontSize(8);
    sideRow++;
  });

  // Timestamp
  const maxRow = Math.max(leftRow, rightRow, sideRow, leaderRow, recRow) + 2;
  const ts = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  sheet.getRange(maxRow, 1, 1, 6).merge()
    .setValue('🔄 ' + ts + ' MSK | Токенов: ' + allItems.length)
    .setFontColor('#9CA3AF').setFontSize(8);
}

function calcAlpha(item) {
  if (!item || !item.updates || item.updates === 0) return 0;
  const updates = Number(item.updates) || 1;
  const totalScore = Number(item.totalScore) || 0;
  const top3Count = Number(item.top3Count) || 0;
  const greenDays = Number(item.greenDays) || 0;
  const moonDays = Number(item.moonDays) || 0;
  const avgGain = Number(item.avgGain) || 0;

  const s1 = Math.min(30, (totalScore / updates) * 3);
  const s2 = Math.min(25, (top3Count / updates) * 25);
  const s3 = Math.min(20, (greenDays / updates) * 20);
  const s4 = Math.min(15, (moonDays / updates) * 150);
  const s5 = Math.min(10, Math.max(0, avgGain));

  const result = Math.round(Math.min(100, s1 + s2 + s3 + s4 + s5));
  return isNaN(result) ? 0 : result;
}

// ============================================================================
// УТИЛИТЫ
// ============================================================================

function truncateName(name, maxLen) {
  if (!name) return 'Unknown';
  const s = String(name);
  return s.length <= maxLen ? s : s.substring(0, maxLen - 2) + '..';
}

function formatGain(value) {
  if (value == null || isNaN(value)) return 'N/A';
  const num = Number(value);
  return (num >= 0 ? '+' : '') + num.toFixed(1) + '%';
}

function formatPrice(price) {
  if (!price) return 'N/A';
  if (price >= 1000) return '$' + price.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
  if (price >= 1) return '$' + price.toFixed(2).replace('.', ',');
  if (price >= 0.01) return '$' + price.toFixed(4).replace('.', ',');
  return '$' + price.toFixed(6).replace('.', ',');
}

function formatMarketCap(mcap) {
  if (!mcap) return 'N/A';
  if (mcap >= 1e12) return '$' + (mcap / 1e12).toFixed(1) + 'T';
  if (mcap >= 1e9) return '$' + (mcap / 1e9).toFixed(1) + 'B';
  if (mcap >= 1e6) return '$' + (mcap / 1e6).toFixed(0) + 'M';
  return '$' + (mcap / 1e3).toFixed(0) + 'K';
}

function getHeatmapColor(pct) {
  if (pct >= 10) return '#22C55E';
  if (pct >= 5) return '#86EFAC';
  if (pct >= 2) return '#BBF7D0';
  if (pct >= 0) return '#DCFCE7';
  if (pct >= -2) return '#FEE2E2';
  if (pct >= -5) return '#FECACA';
  if (pct >= -10) return '#FCA5A5';
  return '#F87171';
}

function lightenColor(hex, factor) {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const newR = Math.round(r + (255 - r) * factor);
  const newG = Math.round(g + (255 - g) * factor);
  const newB = Math.round(b + (255 - b) * factor);
  return '#' + newR.toString(16).padStart(2, '0') + newG.toString(16).padStart(2, '0') + newB.toString(16).padStart(2, '0');
}
