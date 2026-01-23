/**
 * Crypto Sectors Dashboard - Main Application
 * Real-time market data visualization
 */

// Translations
const TRANSLATIONS = {
  ru: {
    language: 'Язык',
    theme: 'Тема',
    searchPlaceholder: 'Поиск токенов...',
    // Navigation
    heatmap: 'Тепловая карта',
    overview: 'Обзор',
    sectors: 'Все секторы',
    telegram: 'Телеграм',
    setupManager: 'Setup Manager',
    // Page titles
    marketOverview: 'Обзор рынка',
    performanceHeatmap: 'Тепловая карта',
    allSectors: 'Все секторы',
    sectorsSubtitle: '20 секторов • Данные CoinGecko',
    heatmapSubtitle: 'Визуальное сравнение секторов',
    allSectorsSubtitle: 'Детальный обзор каждого сектора',
    totalMarketCap: 'Общая капитализация',
    bestSector: 'Лучший сектор (24ч)',
    worstSector: 'Худший сектор (24ч)',
    topGainer: 'Топ рост (24ч)',
    sectorsPerformance: 'Показатели секторов',
    performance: 'Динамика',
    sortBy: 'Сортировка:',
    marketCap: 'Капитализация',
    change24h: 'Изменение 24ч',
    change7d: 'Изменение 7д',
    change30d: 'Изменение 30д',
    nameAZ: 'Имя А-Я',
    loading: 'Загрузка данных...',
    fetchingSectors: 'Получение секторов',
    noTokensFound: 'Токены не найдены',
    updated: 'Обновлено',
    updateInfo: 'Обновление: каждые 5 мин',
    donateHint: '30 сек при донате от $35',
    sector: 'Сектор',
    topGainerCol: 'Лидер роста',
    token: 'Токен',
    price: 'Цена',
    viewOnCoinGecko: 'Открыть на CoinGecko →',
    volume24h: '24ч Объём',
    high24h: '24ч Макс',
    low24h: '24ч Мин',
    athChange: 'От ATH',
    // Momentum
    momentum: 'Сила роста',
    momentumTitle: 'Momentum Рейтинг',
    momentumSubtitle: 'Анализ исторической динамики во время ралли',
    marketState: 'Состояние рынка',
    bullPhases: 'Бычьих фаз',
    avgDuration: 'Ср. длительность',
    topRallyPerformers: 'Топ Rally Performers',
    tokensWithBestDynamics: 'Токены с лучшей динамикой во время бычьих фаз',
    sectorMomentum: 'Momentum секторов',
    recentBullPhases: 'Последние бычьи фазы',
    beta: 'Бета',
    consistency: 'Консистентность',
    avgGain: 'Ср. рост',
    momentumScore: 'Momentum Score',
    tierS: 'Исторически пампится сильнее всех',
    tierA: 'Сильный участник ралли',
    tierB: 'Выше среднего',
    tierC: 'Средний, следует за рынком',
    tierD: 'Слабая корреляция',
    tierF: 'Минимальная корреляция с ралли',
    marketBull: 'БЫЧИЙ',
    marketNeutral: 'НЕЙТРАЛЬНЫЙ',
    marketBear: 'МЕДВЕЖИЙ',
    btcShowsStrength: 'BTC показывает сильный рост',
    btcNoMovement: 'BTC не показывает сильного движения',
    btcShowsWeakness: 'BTC показывает слабость',
    // Fear & Greed
    fearGreed: 'Индекс страха и жадности',
    extremeFear: 'Крайний страх',
    fear: 'Страх',
    neutral: 'Нейтрально',
    greed: 'Жадность',
    extremeGreed: 'Крайняя жадность',
    // FAQ
    faq: 'FAQ',
    faqTitle: 'Часто задаваемые вопросы',
    faqQ1: 'Что такое Momentum Score?',
    faqA1: 'Momentum Score (0-100) показывает насколько хорошо токен исторически рос во время бычьих фаз рынка. Высокий скор означает, что токен обычно растёт сильнее BTC когда рынок на подъёме.',
    faqQ2: 'Как определяется бычья фаза?',
    faqA2: 'Бычья фаза начинается когда BTC показывает рост >5% за 24 часа, продолжается пока рост >2%, и заканчивается когда рост падает ниже 2%.',
    faqQ3: 'Что такое Beta?',
    faqA3: 'Beta показывает во сколько раз токен в среднем растёт относительно BTC. Beta 2.5x означает, что если BTC вырос на 10%, токен в среднем вырастет на 25%.',
    faqQ4: 'Что такое Consistency?',
    faqA4: 'Consistency показывает в каком проценте бычьих фаз токен входил в топ-20% лучших по росту. Высокая консистентность означает стабильную силу во время ралли.'
  },
  en: {
    language: 'Language',
    theme: 'Theme',
    searchPlaceholder: 'Search tokens...',
    // Navigation
    heatmap: 'Heatmap',
    overview: 'Overview',
    sectors: 'All Sectors',
    telegram: 'Telegram',
    setupManager: 'Setup Manager',
    // Page titles
    marketOverview: 'Market Overview',
    performanceHeatmap: 'Performance Heatmap',
    allSectors: 'All Sectors',
    sectorsSubtitle: '20 sectors • CoinGecko data',
    heatmapSubtitle: 'Visual sector comparison',
    allSectorsSubtitle: 'Detailed view of each sector',
    totalMarketCap: 'Total Market Cap',
    bestSector: 'Best Sector (24h)',
    worstSector: 'Worst Sector (24h)',
    topGainer: 'Top Gainer (24h)',
    sectorsPerformance: 'Sectors Performance',
    performance: 'Performance',
    sortBy: 'Sort by:',
    marketCap: 'Market Cap',
    change24h: '24h Change',
    change7d: '7d Change',
    change30d: '30d Change',
    nameAZ: 'Name A-Z',
    loading: 'Loading market data...',
    fetchingSectors: 'Fetching sectors',
    noTokensFound: 'No tokens found',
    updated: 'Updated',
    updateInfo: 'Updates: every 5 min',
    donateHint: '30 sec with $35+ donation',
    sector: 'Sector',
    topGainerCol: 'Top Gainer',
    token: 'Token',
    price: 'Price',
    viewOnCoinGecko: 'View on CoinGecko →',
    volume24h: '24h Volume',
    high24h: '24h High',
    low24h: '24h Low',
    athChange: 'ATH Change',
    // Momentum
    momentum: 'Momentum',
    momentumTitle: 'Momentum Rating',
    momentumSubtitle: 'Historical rally performance analysis',
    marketState: 'Market State',
    bullPhases: 'Bull Phases',
    avgDuration: 'Avg Duration',
    topRallyPerformers: 'Top Rally Performers',
    tokensWithBestDynamics: 'Tokens with best performance during bull phases',
    sectorMomentum: 'Sector Momentum',
    recentBullPhases: 'Recent Bull Phases',
    beta: 'Beta',
    consistency: 'Consistency',
    avgGain: 'Avg Gain',
    momentumScore: 'Momentum Score',
    tierS: 'Historically pumps the hardest',
    tierA: 'Strong rally participant',
    tierB: 'Above average',
    tierC: 'Average, follows market',
    tierD: 'Weak correlation',
    tierF: 'Minimal rally correlation',
    marketBull: 'BULL',
    marketNeutral: 'NEUTRAL',
    marketBear: 'BEAR',
    btcShowsStrength: 'BTC shows strong growth',
    btcNoMovement: 'BTC shows no strong movement',
    btcShowsWeakness: 'BTC shows weakness',
    // Fear & Greed
    fearGreed: 'Fear & Greed Index',
    extremeFear: 'Extreme Fear',
    fear: 'Fear',
    neutral: 'Neutral',
    greed: 'Greed',
    extremeGreed: 'Extreme Greed',
    // FAQ
    faq: 'FAQ',
    faqTitle: 'Frequently Asked Questions',
    faqQ1: 'What is Momentum Score?',
    faqA1: 'Momentum Score (0-100) shows how well a token historically performed during bull phases. A high score means the token usually outperforms BTC when the market is rising.',
    faqQ2: 'How is a bull phase defined?',
    faqA2: 'A bull phase starts when BTC shows >5% growth in 24h, continues while growth is >2%, and ends when growth drops below 2%.',
    faqQ3: 'What is Beta?',
    faqA3: 'Beta shows how much a token grows relative to BTC on average. Beta 2.5x means if BTC grows 10%, the token grows 25% on average.',
    faqQ4: 'What is Consistency?',
    faqA4: 'Consistency shows in what percentage of bull phases the token was in the top 20% performers. High consistency means stable strength during rallies.'
  }
};

class CryptoDashboard {
  constructor() {
    this.coinData = new Map();
    this.sectorStats = [];
    this.filteredSectorStats = null; // For search filtering
    this.currentView = 'heatmap'; // Default to heatmap
    this.currentSort = '24h';
    this.currentPeriod = '24h';
    this.heatmapSort = 'mcap'; // Default sort by market cap
    this.currentLang = 'ru'; // Default language
    this.refreshInterval = null;
    this.isLoading = false;

    // Momentum data
    this.momentumData = null;
    this.marketState = null;
    this.bullPhases = null;
    this.fearGreedData = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadTheme();
    this.loadSidebarState();
    this.loadLanguage();
    this.loadData();
    this.loadMomentumData();
    this.startAutoRefresh();
  }

  bindEvents() {
    // Navigation
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchView(e.target.closest('.nav-item').dataset.view));
    });

    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

    // Sidebar toggle
    document.getElementById('sidebarToggle').addEventListener('click', () => this.toggleSidebar());

    // Language toggle
    document.getElementById('langToggle').addEventListener('click', () => this.toggleLanguage());

    // Search
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim()) this.showSearchDropdown();
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-box')) this.hideSearchDropdown();
    });

    // Period buttons (heatmap)
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handlePeriodChange(e.target.dataset.period));
    });

    // Heatmap sort select
    document.getElementById('heatmapSortSelect').addEventListener('change', (e) => {
      this.heatmapSort = e.target.value;
      this.renderHeatmap();
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());

    // Modal close
    document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
    document.getElementById('tokenModal').addEventListener('click', (e) => {
      if (e.target.id === 'tokenModal') this.closeModal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
      if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        this.loadData();
      }
    });
  }

  // ==================== DATA FETCHING ====================

  async loadData() {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      this.updateLoadingProgress(this.t('fetchingSectors'));

      // Fetch all data from server cache (single request)
      const response = await fetch(CONFIG.API_ENDPOINT);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data || data.length === 0) {
        throw new Error('No data received from API');
      }

      // Store data
      this.coinData.clear();
      data.forEach(coin => this.coinData.set(coin.id, coin));

      // Calculate sector stats
      this.calculateSectorStats();

      // Render current view
      this.renderCurrentView();
      this.updateSummary();
      this.hideLoading();
      this.updateLastUpdate();

    } catch (error) {
      console.error('Error loading data:', error);
      this.showError(error.message);
    } finally {
      this.isLoading = false;
    }
  }

  // ==================== DATA PROCESSING ====================

  calculateSectorStats() {
    this.sectorStats = [];

    Object.entries(SECTORS).forEach(([sectorName, tokenIds]) => {
      const stats = {
        name: sectorName,
        color: SECTOR_COLORS[sectorName],
        icon: SECTOR_ICONS[sectorName],
        tokens: [],
        mcap: 0,
        avg24h: 0,
        avg7d: 0,
        avg30d: 0,
        best: null,
        worst: null
      };

      let sum24h = 0, sum7d = 0, sum30d = 0, count = 0;
      let best24h = { value: -Infinity };
      let worst24h = { value: Infinity };

      tokenIds.forEach(tokenId => {
        const coin = this.coinData.get(tokenId);
        if (!coin) return;

        stats.tokens.push(coin);
        stats.mcap += coin.market_cap || 0;

        const pct24h = coin.price_change_percentage_24h_in_currency;
        const pct7d = coin.price_change_percentage_7d_in_currency;
        const pct30d = coin.price_change_percentage_30d_in_currency;

        if (pct24h !== null && pct24h !== undefined) {
          sum24h += pct24h;
          sum7d += pct7d || 0;
          sum30d += pct30d || 0;
          count++;

          if (pct24h > best24h.value) {
            best24h = { symbol: coin.symbol?.toUpperCase(), value: pct24h };
          }
          if (pct24h < worst24h.value) {
            worst24h = { symbol: coin.symbol?.toUpperCase(), value: pct24h };
          }
        }
      });

      if (count > 0) {
        stats.avg24h = sum24h / count;
        stats.avg7d = sum7d / count;
        stats.avg30d = sum30d / count;
      }

      stats.best = best24h.value !== -Infinity ? best24h : null;
      stats.worst = worst24h.value !== Infinity ? worst24h : null;

      this.sectorStats.push(stats);
    });

    // Sort by 24h performance
    this.sortSectorStats();
  }

  sortSectorStats() {
    const sortKey = {
      '24h': 'avg24h',
      '7d': 'avg7d',
      '30d': 'avg30d',
      'mcap': 'mcap'
    }[this.currentSort] || 'avg24h';

    this.sectorStats.sort((a, b) => b[sortKey] - a[sortKey]);
  }

  // ==================== RENDERING ====================

  renderCurrentView() {
    switch (this.currentView) {
      case 'overview':
        this.renderOverview();
        break;
      case 'heatmap':
        this.renderHeatmap();
        break;
      case 'sectors':
        this.renderSectors();
        break;
      case 'momentum':
        this.renderMomentum();
        break;
    }
  }

  renderOverview() {
    const tbody = document.getElementById('sectorsTableBody');
    tbody.innerHTML = '';

    this.getSectorsForRender().forEach((sector, index) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="text-align: center; color: var(--text-muted);">${index + 1}</td>
        <td>
          <div class="sector-badge">
            <span class="sector-color" style="background: ${sector.color}"></span>
            <span class="sector-name">${sector.name}</span>
          </div>
        </td>
        <td class="mcap-value">${this.formatMcap(sector.mcap)}</td>
        <td class="change-value ${this.getChangeClass(sector.avg24h)}">${this.formatPercent(sector.avg24h)}</td>
        <td class="change-value ${this.getChangeClass(sector.avg7d)}">${this.formatPercent(sector.avg7d)}</td>
        <td class="change-value ${this.getChangeClass(sector.avg30d)}">${this.formatPercent(sector.avg30d)}</td>
        <td>
          ${sector.best ? `
            <div class="gainer-info">
              <span class="gainer-symbol">${sector.best.symbol}</span>
              <span class="gainer-change">+${sector.best.value.toFixed(1)}%</span>
            </div>
          ` : '—'}
        </td>
      `;
      
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => this.showSectorDetail(sector.name));
      tbody.appendChild(row);
    });
  }

  renderHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    grid.innerHTML = '';

    const periodKey = {
      '24h': 'price_change_percentage_24h_in_currency',
      '7d': 'price_change_percentage_7d_in_currency',
      '30d': 'price_change_percentage_30d_in_currency'
    }[this.currentPeriod];

    const avgKey = {
      '24h': 'avg24h',
      '7d': 'avg7d',
      '30d': 'avg30d'
    }[this.currentPeriod];

    // Sort sectors based on heatmapSort
    let sortedSectors = [...this.getSectorsForRender()];
    switch (this.heatmapSort) {
      case 'mcap':
        sortedSectors.sort((a, b) => b.mcap - a.mcap);
        break;
      case '24h':
        sortedSectors.sort((a, b) => b.avg24h - a.avg24h);
        break;
      case '7d':
        sortedSectors.sort((a, b) => b.avg7d - a.avg7d);
        break;
      case '30d':
        sortedSectors.sort((a, b) => b.avg30d - a.avg30d);
        break;
      case 'name':
        sortedSectors.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    // Calculate total market cap for scaling
    const totalMcap = sortedSectors.reduce((sum, s) => sum + s.mcap, 0);

    sortedSectors.forEach(sector => {
      const sectorDiv = document.createElement('div');
      sectorDiv.className = 'heatmap-sector';

      // Scale sector size by market cap (min 15%, max 40%)
      const mcapRatio = sector.mcap / totalMcap;
      const sizePercent = Math.max(15, Math.min(40, mcapRatio * 200));
      sectorDiv.style.flex = `1 1 ${sizePercent}%`;
      sectorDiv.style.borderLeft = `4px solid ${sector.color}`;

      const avgChange = sector[avgKey];
      const sectorBgColor = this.getHeatmapColor(avgChange);

      // Calculate token sizes by market cap within sector
      const sectorTotalMcap = sector.tokens.reduce((sum, t) => sum + (t.market_cap || 0), 0);

      sectorDiv.innerHTML = `
        <div class="heatmap-sector-header" style="background: ${sectorBgColor}15;">
          <div class="heatmap-sector-title">
            <span class="heatmap-sector-icon">${sector.icon}</span>
            <span class="heatmap-sector-name">${sector.name}</span>
          </div>
          <div class="heatmap-sector-stats">
            <span class="heatmap-sector-change ${this.getChangeClass(avgChange)}">${this.formatPercent(avgChange)}</span>
            <span class="heatmap-sector-mcap">${this.formatMcap(sector.mcap)}</span>
          </div>
        </div>
        <div class="heatmap-tokens-grid">
          ${sector.tokens.slice(0, 10).map(token => {
            const change = token[periodKey] || 0;
            const bgColor = this.getHeatmapColor(change);
            // Scale token size by market cap (min 1, max 3 units)
            const tokenMcapRatio = (token.market_cap || 0) / sectorTotalMcap;
            const tokenSize = Math.max(1, Math.min(3, tokenMcapRatio * 10));
            return `
              <div class="heatmap-token-large"
                   style="background: ${bgColor}; flex: ${tokenSize};"
                   title="${token.name}: ${this.formatPercent(change)} | MCap: ${this.formatMcap(token.market_cap)}"
                   data-token-id="${token.id}">
                <span class="token-symbol">${token.symbol?.toUpperCase()}</span>
                <span class="token-change">${this.formatPercent(change)}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Token click handler
      sectorDiv.querySelectorAll('.heatmap-token-large').forEach(tokenEl => {
        tokenEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this.showTokenModal(tokenEl.dataset.tokenId);
        });
      });

      grid.appendChild(sectorDiv);
    });
  }

  renderSectors() {
    const grid = document.getElementById('sectorsGrid');
    grid.innerHTML = '';

    this.getSectorsForRender().forEach(sector => {
      const card = document.createElement('div');
      card.className = 'sector-card';

      card.innerHTML = `
        <div class="sector-card-header" style="border-top: 3px solid ${sector.color}">
          <div class="sector-card-title">
            <div class="sector-card-icon" style="background: ${sector.color}20; color: ${sector.color}">
              ${sector.icon}
            </div>
            <span class="sector-card-name">${sector.name}</span>
          </div>
          <div class="sector-card-stats">
            <div class="sector-stat">
              <div class="sector-stat-label">24h</div>
              <div class="sector-stat-value ${this.getChangeClass(sector.avg24h)}">${this.formatPercent(sector.avg24h)}</div>
            </div>
            <div class="sector-stat">
              <div class="sector-stat-label">MCap</div>
              <div class="sector-stat-value">${this.formatMcap(sector.mcap)}</div>
            </div>
          </div>
        </div>
        <table class="sector-tokens-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Token</th>
              <th style="text-align: right">Price</th>
              <th style="text-align: right">24h</th>
              <th style="text-align: right">MCap</th>
            </tr>
          </thead>
          <tbody>
            ${sector.tokens.slice(0, 10).map((token, i) => `
              <tr data-token-id="${token.id}">
                <td style="color: var(--text-muted)">${i + 1}</td>
                <td>
                  <div class="token-info">
                    <img class="token-icon" src="${token.image}" alt="${token.symbol}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23ddd%22/></svg>'">
                    <div>
                      <div class="token-name">${this.truncate(token.name, 15)}</div>
                      <div class="token-symbol">${token.symbol?.toUpperCase()}</div>
                    </div>
                  </div>
                </td>
                <td class="token-price">${this.formatPrice(token.current_price)}</td>
                <td class="token-change ${this.getChangeClass(token.price_change_percentage_24h_in_currency)}">
                  ${this.formatPercent(token.price_change_percentage_24h_in_currency)}
                </td>
                <td class="token-mcap">${this.formatMcap(token.market_cap)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // Token row click handler
      card.querySelectorAll('tbody tr').forEach(row => {
        row.addEventListener('click', () => this.showTokenModal(row.dataset.tokenId));
      });

      grid.appendChild(card);
    });
  }

  updateSummary() {
    // Total market cap
    const totalMcap = this.sectorStats.reduce((sum, s) => sum + s.mcap, 0);
    document.getElementById('totalMcap').textContent = this.formatMcap(totalMcap);

    // Calculate average change
    const avgChange = this.sectorStats.reduce((sum, s) => sum + s.avg24h, 0) / this.sectorStats.length;
    const changeEl = document.getElementById('totalMcapChange');
    changeEl.textContent = this.formatPercent(avgChange);
    changeEl.className = `summary-change ${avgChange >= 0 ? 'positive' : 'negative'}`;

    // Best/worst sectors
    const sorted = [...this.sectorStats].sort((a, b) => b.avg24h - a.avg24h);
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    document.getElementById('bestSector').textContent = best?.name || '—';
    document.getElementById('bestSectorChange').textContent = this.formatPercent(best?.avg24h);

    document.getElementById('worstSector').textContent = worst?.name || '—';
    document.getElementById('worstSectorChange').textContent = this.formatPercent(worst?.avg24h);

    // Top gainer token
    let topGainer = null;
    this.coinData.forEach(coin => {
      const change = coin.price_change_percentage_24h_in_currency;
      if (!topGainer || (change && change > (topGainer.price_change_percentage_24h_in_currency || 0))) {
        topGainer = coin;
      }
    });

    if (topGainer) {
      document.getElementById('topGainer').textContent = topGainer.symbol?.toUpperCase();
      document.getElementById('topGainerChange').textContent = this.formatPercent(topGainer.price_change_percentage_24h_in_currency);
    }

    // Update quick sectors bar
    this.renderQuickSectorsBar();
  }

  renderQuickSectorsBar() {
    const container = document.getElementById('quickSectorsScroll');
    if (!container || this.sectorStats.length === 0) return;

    // Sort sectors by 24h change
    const sortedSectors = [...this.sectorStats].sort((a, b) => b.avg24h - a.avg24h);

    container.innerHTML = sortedSectors.map(sector => {
      const changeClass = sector.avg24h >= 0 ? 'positive' : 'negative';
      return `
        <div class="quick-sector-pill" data-sector="${sector.name}">
          <span class="quick-sector-dot" style="background: ${sector.color}"></span>
          <span class="quick-sector-name">${sector.name}</span>
          <span class="quick-sector-change ${changeClass}">${this.formatPercent(sector.avg24h)}</span>
        </div>
      `;
    }).join('');

    // Add click handlers
    container.querySelectorAll('.quick-sector-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        this.showSectorDetail(pill.dataset.sector);
      });
    });
  }

  // ==================== UI HANDLERS ====================

  switchView(view) {
    this.currentView = view;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === view);
    });

    // Update title using translations
    this.updatePageTitle();

    // Show/hide views
    document.getElementById('overviewView').classList.toggle('hidden', view !== 'overview');
    document.getElementById('heatmapView').classList.toggle('hidden', view !== 'heatmap');
    document.getElementById('sectorsView').classList.toggle('hidden', view !== 'sectors');
    document.getElementById('momentumView').classList.toggle('hidden', view !== 'momentum');

    this.renderCurrentView();
  }

  handleSort(sort) {
    this.currentSort = sort;
    
    // Update UI
    document.querySelectorAll('.sort-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.sort === sort);
    });
    document.getElementById('sortLabel').textContent = {
      '24h': '24h %',
      '7d': '7d %',
      '30d': '30d %',
      'mcap': 'Market Cap'
    }[sort];

    this.sortSectorStats();
    this.renderCurrentView();
  }

  handlePeriodChange(period) {
    this.currentPeriod = period;
    
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.period === period);
    });

    this.renderHeatmap();
  }

  handleSearch(query) {
    const normalizedQuery = query.toLowerCase().trim();

    if (!normalizedQuery) {
      // Reset to show all
      this.filteredSectorStats = null;
      this.hideSearchDropdown();
      this.renderCurrentView();
      return;
    }

    // Find matching tokens for dropdown
    const matchingTokens = [];
    this.coinData.forEach(token => {
      if (
        token.name?.toLowerCase().includes(normalizedQuery) ||
        token.symbol?.toLowerCase().includes(normalizedQuery)
      ) {
        matchingTokens.push(token);
      }
    });

    // Sort by market cap and limit to 8 results
    matchingTokens.sort((a, b) => (b.market_cap || 0) - (a.market_cap || 0));
    this.renderSearchDropdown(matchingTokens.slice(0, 8));

    // Filter sectors that have matching tokens
    this.filteredSectorStats = this.sectorStats.map(sector => {
      const filteredTokens = sector.tokens.filter(token =>
        token.name?.toLowerCase().includes(normalizedQuery) ||
        token.symbol?.toLowerCase().includes(normalizedQuery)
      );

      if (filteredTokens.length > 0 || sector.name.toLowerCase().includes(normalizedQuery)) {
        return {
          ...sector,
          tokens: filteredTokens.length > 0 ? filteredTokens : sector.tokens
        };
      }
      return null;
    }).filter(Boolean);

    this.renderCurrentView();
  }

  renderSearchDropdown(tokens) {
    const dropdown = document.getElementById('searchDropdown');

    if (tokens.length === 0) {
      dropdown.innerHTML = '<div class="search-no-results">No tokens found</div>';
      this.showSearchDropdown();
      return;
    }

    dropdown.innerHTML = tokens.map(token => {
      const change = token.price_change_percentage_24h_in_currency;
      const changeClass = change >= 0 ? 'positive' : 'negative';
      return `
        <div class="search-result-item" data-token-id="${token.id}">
          <img class="search-result-icon" src="${token.image}" alt="${token.symbol}"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23ddd%22/></svg>'">
          <div class="search-result-info">
            <div class="search-result-name">${token.name}</div>
            <div class="search-result-symbol">${token.symbol}</div>
          </div>
          <div class="search-result-stats">
            <div class="search-result-price">${this.formatPrice(token.current_price)}</div>
            <div class="search-result-change ${changeClass}">${this.formatPercent(change)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    dropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showTokenModal(item.dataset.tokenId);
        this.hideSearchDropdown();
        document.getElementById('searchInput').value = '';
        this.filteredSectorStats = null;
        this.renderCurrentView();
      });
    });

    this.showSearchDropdown();
  }

  showSearchDropdown() {
    document.getElementById('searchDropdown').classList.remove('hidden');
  }

  hideSearchDropdown() {
    document.getElementById('searchDropdown').classList.add('hidden');
  }

  // Get sectors for rendering (filtered or all)
  getSectorsForRender() {
    return this.filteredSectorStats || this.sectorStats;
  }

  showSectorDetail(sectorName) {
    // Switch to sectors view and scroll to the sector
    this.switchView('sectors');
    
    // Find and highlight the sector card
    const cards = document.querySelectorAll('.sector-card');
    cards.forEach(card => {
      const name = card.querySelector('.sector-card-name')?.textContent;
      if (name === sectorName) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.boxShadow = 'var(--shadow-glow)';
        setTimeout(() => card.style.boxShadow = '', 2000);
      }
    });
  }

  showTokenModal(tokenId) {
    const token = this.coinData.get(tokenId);
    if (!token) return;

    const modal = document.getElementById('tokenModal');
    
    document.getElementById('modalTokenIcon').src = token.image;
    document.getElementById('modalTokenName').textContent = token.name;
    document.getElementById('modalTokenSymbol').textContent = token.symbol?.toUpperCase();
    document.getElementById('modalPrice').textContent = this.formatPrice(token.current_price);
    
    const change24h = token.price_change_percentage_24h_in_currency;
    const changeEl = document.getElementById('modalChange');
    changeEl.textContent = this.formatPercent(change24h);
    changeEl.className = `modal-change ${change24h >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('modalMcap').textContent = this.formatMcap(token.market_cap);
    document.getElementById('modalVolume').textContent = this.formatMcap(token.total_volume);
    document.getElementById('modalHigh').textContent = this.formatPrice(token.high_24h);
    document.getElementById('modalLow').textContent = this.formatPrice(token.low_24h);
    document.getElementById('modalATH').textContent = this.formatPrice(token.ath);
    
    const athChange = token.ath_change_percentage;
    const athChangeEl = document.getElementById('modalATHChange');
    athChangeEl.textContent = this.formatPercent(athChange);
    athChangeEl.className = athChange >= 0 ? 'positive' : 'negative';

    // Period changes
    const periods = ['24h', '7d', '30d'];
    periods.forEach(p => {
      const key = `price_change_percentage_${p === '24h' ? '24h' : p}_in_currency`;
      const value = token[key];
      const el = document.getElementById(`modal${p.charAt(0).toUpperCase() + p.slice(1)}`);
      if (el) {
        el.textContent = this.formatPercent(value);
        el.className = `change-value ${this.getChangeClass(value)}`;
      }
    });

    document.getElementById('modalCoinGecko').href = `https://www.coingecko.com/en/coins/${token.id}`;

    // Momentum data
    this.updateModalMomentum(tokenId);

    modal.classList.remove('hidden');
  }

  updateModalMomentum(tokenId) {
    const momentumSection = document.getElementById('modalMomentum');
    if (!momentumSection) return;

    const tokenMomentum = this.momentumData?.tokens?.find(t => t.id === tokenId);

    if (!tokenMomentum) {
      momentumSection.classList.add('hidden');
      return;
    }

    momentumSection.classList.remove('hidden');

    const tier = this.getTierInfo(tokenMomentum.score);

    document.getElementById('modalMomentumBadge').textContent = tokenMomentum.tier;
    document.getElementById('modalMomentumBadge').style.background = tier.color;
    document.getElementById('modalMomentumScore').textContent = tokenMomentum.score;
    document.getElementById('modalMomentumBeta').textContent = `${tokenMomentum.beta.toFixed(2)}x`;
    document.getElementById('modalMomentumConsistency').textContent = `${tokenMomentum.consistency.toFixed(0)}%`;
    document.getElementById('modalMomentumAvgGain').textContent = `+${tokenMomentum.avgGain.toFixed(1)}%`;
    document.getElementById('modalMomentumDesc').textContent = this.getTierDescription(tokenMomentum.tier);
  }

  closeModal() {
    document.getElementById('tokenModal').classList.add('hidden');
  }

  // ==================== THEME ====================

  toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }

  loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  // ==================== SIDEBAR ====================

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
  }

  loadSidebarState() {
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
      document.getElementById('sidebar').classList.add('collapsed');
    }
  }

  // ==================== LANGUAGE ====================

  t(key) {
    return TRANSLATIONS[this.currentLang][key] || key;
  }

  toggleLanguage() {
    this.currentLang = this.currentLang === 'ru' ? 'en' : 'ru';
    document.documentElement.setAttribute('data-lang', this.currentLang);
    localStorage.setItem('lang', this.currentLang);
    this.applyTranslations();
  }

  loadLanguage() {
    const savedLang = localStorage.getItem('lang') || 'ru';
    this.currentLang = savedLang;
    document.documentElement.setAttribute('data-lang', savedLang);
    this.applyTranslations();
  }

  applyTranslations() {
    // Navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      const view = item.dataset.view;
      const span = item.querySelector('span');
      if (span && view) {
        span.textContent = this.t(view);
      }
    });

    // Sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
      const span = link.querySelector('span');
      if (span) {
        if (link.href.includes('t.me')) {
          span.textContent = this.t('telegram');
        } else if (link.href.includes('setupmanager')) {
          span.textContent = this.t('setupManager');
        }
      }
    });

    // Search placeholder
    document.getElementById('searchInput').placeholder = this.t('searchPlaceholder');

    // Heatmap controls
    const sortLabel = document.querySelector('.heatmap-sort-label');
    if (sortLabel) sortLabel.textContent = this.t('sortBy');

    const legendLabel = document.querySelector('.legend-label');
    if (legendLabel) legendLabel.textContent = this.t('performance');

    // Update select options
    const sortSelect = document.getElementById('heatmapSortSelect');
    if (sortSelect) {
      sortSelect.options[0].text = this.t('marketCap');
      sortSelect.options[1].text = this.t('change24h');
      sortSelect.options[2].text = this.t('change7d');
      sortSelect.options[3].text = this.t('change30d');
      sortSelect.options[4].text = this.t('nameAZ');
    }

    // Sidebar labels
    document.querySelector('.lang-label').textContent = this.t('language');
    document.querySelector('.theme-label').textContent = this.t('theme');

    // Update info
    const updateInfo = document.querySelector('.update-info span');
    if (updateInfo) updateInfo.textContent = this.t('updateInfo');

    const donateHint = document.querySelector('.donate-hint');
    if (donateHint) donateHint.textContent = this.t('donateHint');

    // Summary cards
    const summaryLabels = document.querySelectorAll('.summary-label');
    if (summaryLabels.length >= 4) {
      summaryLabels[0].textContent = this.t('totalMarketCap');
      summaryLabels[1].textContent = this.t('bestSector');
      summaryLabels[2].textContent = this.t('worstSector');
      summaryLabels[3].textContent = this.t('topGainer');
    }

    // Card title
    const cardTitle = document.querySelector('.sectors-overview-card .card-title');
    if (cardTitle) cardTitle.textContent = this.t('sectorsPerformance');

    // FAQ section
    const faqItems = document.querySelectorAll('.faq-item');
    if (faqItems.length >= 4) {
      faqItems[0].querySelector('.faq-question').textContent = this.t('faqQ1');
      faqItems[0].querySelector('.faq-answer').textContent = this.t('faqA1');
      faqItems[1].querySelector('.faq-question').textContent = this.t('faqQ2');
      faqItems[1].querySelector('.faq-answer').textContent = this.t('faqA2');
      faqItems[2].querySelector('.faq-question').textContent = this.t('faqQ3');
      faqItems[2].querySelector('.faq-answer').textContent = this.t('faqA3');
      faqItems[3].querySelector('.faq-question').textContent = this.t('faqQ4');
      faqItems[3].querySelector('.faq-answer').textContent = this.t('faqA4');
    }

    const faqTitle = document.querySelector('.faq-card .card-title');
    if (faqTitle) faqTitle.textContent = this.t('faqTitle');

    // Update all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key && this.t(key)) {
        el.textContent = this.t(key);
      }
    });

    // Re-render Fear & Greed label
    if (this.fearGreedData) {
      this.renderFearGreedIndicator();
    }

    // Update page title based on view
    this.updatePageTitle();
  }

  updatePageTitle() {
    const titles = {
      'overview': [this.t('marketOverview'), this.t('sectorsSubtitle')],
      'heatmap': [this.t('performanceHeatmap'), this.t('heatmapSubtitle')],
      'sectors': [this.t('allSectors'), this.t('allSectorsSubtitle')],
      'momentum': [this.t('momentumTitle'), this.t('momentumSubtitle')]
    };
    document.getElementById('pageTitle').textContent = titles[this.currentView][0];
    document.getElementById('pageSubtitle').textContent = titles[this.currentView][1];
  }

  // ==================== EXPORT ====================

  exportCSV() {
    const rows = [
      ['Sector', 'Market Cap', '24h %', '7d %', '30d %', 'Top Gainer', 'Gainer %']
    ];

    this.sectorStats.forEach(sector => {
      rows.push([
        sector.name,
        sector.mcap,
        sector.avg24h?.toFixed(2) || '',
        sector.avg7d?.toFixed(2) || '',
        sector.avg30d?.toFixed(2) || '',
        sector.best?.symbol || '',
        sector.best?.value?.toFixed(2) || ''
      ]);
    });

    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `crypto-sectors-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    URL.revokeObjectURL(url);
  }

  // ==================== UTILITIES ====================

  formatPrice(price) {
    if (price === null || price === undefined) return 'N/A';
    
    if (price >= 1000) {
      return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
    } else if (price >= 1) {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (price >= 0.01) {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    } else {
      return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 8 });
    }
  }

  formatMcap(mcap) {
    if (mcap === null || mcap === undefined) return 'N/A';
    
    if (mcap >= 1e12) return '$' + (mcap / 1e12).toFixed(1) + 'T';
    if (mcap >= 1e9) return '$' + (mcap / 1e9).toFixed(1) + 'B';
    if (mcap >= 1e6) return '$' + (mcap / 1e6).toFixed(0) + 'M';
    if (mcap >= 1e3) return '$' + (mcap / 1e3).toFixed(0) + 'K';
    return '$' + mcap.toFixed(0);
  }

  formatPercent(value) {
    if (value === null || value === undefined) return 'N/A';
    const sign = value >= 0 ? '+' : '';
    return sign + value.toFixed(2) + '%';
  }

  getChangeClass(value) {
    if (value === null || value === undefined) return '';
    return value >= 0 ? 'positive' : 'negative';
  }

  getHeatmapColor(pct) {
    if (pct >= 10) return '#22C55E';
    if (pct >= 5) return '#86EFAC';
    if (pct >= 2) return '#BBF7D0';
    if (pct >= 0) return '#DCFCE7';
    if (pct >= -2) return '#FEE2E2';
    if (pct >= -5) return '#FECACA';
    if (pct >= -10) return '#FCA5A5';
    return '#EF4444';
  }

  truncate(str, maxLen) {
    if (!str) return '';
    return str.length > maxLen ? str.slice(0, maxLen - 2) + '..' : str;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== LOADING STATES ====================

  showLoading() {
    document.getElementById('loadingState').classList.remove('hidden');
    document.getElementById('errorState').classList.add('hidden');
    document.getElementById('overviewView').classList.add('hidden');
    document.getElementById('heatmapView').classList.add('hidden');
    document.getElementById('sectorsView').classList.add('hidden');
    
    document.querySelector('.update-dot').classList.remove('error');
  }

  hideLoading() {
    document.getElementById('loadingState').classList.add('hidden');

    // Show appropriate view
    this.switchView(this.currentView);
  }

  updateLoadingProgress(text) {
    document.getElementById('loadingProgress').textContent = text;
  }

  showError(message) {
    document.getElementById('loadingState').classList.add('hidden');
    document.getElementById('errorState').classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
    document.querySelector('.update-dot').classList.add('error');
  }

  updateLastUpdate() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('lastUpdate').innerHTML = `
      <span class="update-dot"></span>
      <span>Updated ${timeStr}</span>
    `;
  }

  // ==================== MOMENTUM SYSTEM ====================

  async loadMomentumData() {
    try {
      // Load all momentum data in parallel
      const [momentumRes, marketStateRes, phasesRes, fearGreedRes] = await Promise.all([
        fetch('/api/momentum'),
        fetch('/api/market-state'),
        fetch('/api/bull-phases?limit=10'),
        fetch('/api/fear-greed')
      ]);

      if (momentumRes.ok) {
        this.momentumData = await momentumRes.json();
      }

      if (marketStateRes.ok) {
        this.marketState = await marketStateRes.json();
        this.renderMarketStateIndicator();
      }

      if (phasesRes.ok) {
        this.bullPhases = await phasesRes.json();
      }

      if (fearGreedRes.ok) {
        this.fearGreedData = await fearGreedRes.json();
        this.renderFearGreedIndicator();
      }

      // Re-render momentum view if active
      if (this.currentView === 'momentum') {
        this.renderMomentum();
      }

    } catch (error) {
      console.error('Error loading momentum data:', error);
    }
  }

  renderMarketStateIndicator() {
    const indicator = document.getElementById('marketStateIndicator');
    if (!indicator || !this.marketState) return;

    const state = this.marketState.state || 'neutral';
    const config = MOMENTUM_CONFIG.MARKET_STATE[state];
    const btc24h = this.marketState.btc24h || 0;

    const stateLabels = {
      bull: this.t('marketBull'),
      neutral: this.t('marketNeutral'),
      bear: this.t('marketBear')
    };

    indicator.innerHTML = `
      <span class="market-state-icon" style="color: ${config.color}">${config.icon}</span>
      <span class="market-state-label" style="color: ${config.color}">${stateLabels[state]}</span>
      <span class="market-state-btc ${btc24h >= 0 ? 'positive' : 'negative'}">BTC: ${this.formatPercent(btc24h)}</span>
    `;
    indicator.style.background = config.bgColor;
    indicator.style.borderColor = config.color;
  }

  renderFearGreedIndicator() {
    const indicator = document.getElementById('fearGreedIndicator');
    if (!indicator || !this.fearGreedData) return;

    const value = this.fearGreedData.value;
    const needle = document.getElementById('fngNeedle');
    const valueEl = document.getElementById('fngValue');
    const labelEl = document.getElementById('fngLabel');

    // Set value
    valueEl.textContent = value;

    // Get classification and color
    let label, color;
    if (value <= 25) {
      label = this.t('extremeFear');
      color = '#EF4444';
    } else if (value <= 45) {
      label = this.t('fear');
      color = '#F97316';
    } else if (value <= 55) {
      label = this.t('neutral');
      color = '#A855F7';
    } else if (value <= 75) {
      label = this.t('greed');
      color = '#84CC16';
    } else {
      label = this.t('extremeGreed');
      color = '#22C55E';
    }

    labelEl.textContent = label;
    labelEl.style.color = color;
    valueEl.style.color = color;

    // Rotate needle (0 = -90deg, 100 = 90deg)
    const rotation = (value / 100) * 180 - 90;
    needle.style.transform = `rotate(${rotation}deg)`;
    needle.style.background = color;
  }

  renderMomentum() {
    if (!this.momentumData) {
      return;
    }

    this.renderMomentumBanner();
    this.renderMomentumTable();
    this.renderSectorMomentum();
    this.renderBullPhases();
  }

  renderMomentumBanner() {
    const banner = document.getElementById('momentumBanner');
    if (!banner) return;

    const state = this.marketState?.state || 'neutral';
    const config = MOMENTUM_CONFIG.MARKET_STATE[state];

    const stateLabels = {
      bull: this.t('marketBull'),
      neutral: this.t('marketNeutral'),
      bear: this.t('marketBear')
    };

    const stateDescs = {
      bull: this.t('btcShowsStrength'),
      neutral: this.t('btcNoMovement'),
      bear: this.t('btcShowsWeakness')
    };

    banner.style.background = config.bgColor;
    banner.style.borderColor = config.color;

    const bannerLeft = banner.querySelector('.momentum-banner-left');
    if (bannerLeft) {
      bannerLeft.innerHTML = `
        <span class="banner-state-icon" style="color: ${config.color}">${config.icon}</span>
        <div class="banner-state-info">
          <span class="banner-state-label" style="color: ${config.color}">${this.t('marketState')}: ${stateLabels[state]}</span>
          <span class="banner-state-desc">${stateDescs[state]}</span>
        </div>
      `;
    }

    document.getElementById('bannerPhaseCount').textContent = this.momentumData?.phaseCount || 0;
    document.getElementById('bannerAvgDuration').textContent = this.momentumData?.avgPhaseDuration || '0d';
  }

  renderMomentumTable() {
    const tbody = document.getElementById('momentumTableBody');
    if (!tbody || !this.momentumData?.tokens) return;

    // Get sector for each token
    const tokenSector = {};
    Object.entries(SECTORS).forEach(([sector, tokens]) => {
      tokens.forEach(tokenId => {
        if (!tokenSector[tokenId]) {
          tokenSector[tokenId] = sector;
        }
      });
    });

    tbody.innerHTML = this.momentumData.tokens.slice(0, 20).map((token, index) => {
      const tier = this.getTierInfo(token.score);
      const sector = tokenSector[token.id] || '—';
      const coin = this.coinData.get(token.id);

      return `
        <tr data-token-id="${token.id}">
          <td style="text-align: center; color: var(--text-muted);">${index + 1}</td>
          <td>
            <div class="token-info">
              ${coin ? `<img class="token-icon" src="${coin.image}" alt="${token.symbol}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2240%22 fill=%22%23ddd%22/></svg>'">` : ''}
              <div>
                <div class="token-name">${coin?.name || token.symbol}</div>
                <div class="token-symbol">${token.symbol}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="sector-badge-small" style="border-color: ${SECTOR_COLORS[sector] || '#666'}">
              ${sector}
            </span>
          </td>
          <td>
            <span class="momentum-score-badge" style="background: ${tier.color}">${token.tier}</span>
            <span class="momentum-score-number">${token.score}</span>
          </td>
          <td class="beta-value">${token.beta.toFixed(2)}x</td>
          <td class="consistency-value">${token.consistency.toFixed(0)}%</td>
          <td class="avg-gain-value positive">+${token.avgGain.toFixed(1)}%</td>
        </tr>
      `;
    }).join('');

    // Add click handlers
    tbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => this.showTokenModal(row.dataset.tokenId));
    });
  }

  renderSectorMomentum() {
    const container = document.getElementById('sectorMomentumList');
    if (!container || !this.momentumData?.sectors) return;

    const maxScore = Math.max(...Object.values(this.momentumData.sectors).map(s => s.avgScore));

    container.innerHTML = Object.entries(this.momentumData.sectors)
      .sort((a, b) => b[1].avgScore - a[1].avgScore)
      .map(([sector, data]) => {
        const widthPercent = (data.avgScore / maxScore) * 100;
        const color = SECTOR_COLORS[sector] || '#666';

        return `
          <div class="sector-momentum-item">
            <div class="sector-momentum-header">
              <span class="sector-momentum-name">${sector}</span>
              <span class="sector-momentum-score">${data.avgScore}</span>
            </div>
            <div class="sector-momentum-bar-bg">
              <div class="sector-momentum-bar" style="width: ${widthPercent}%; background: ${color}"></div>
            </div>
          </div>
        `;
      }).join('');
  }

  renderBullPhases() {
    const container = document.getElementById('bullPhasesList');
    if (!container || !this.bullPhases?.phases) return;

    container.innerHTML = this.bullPhases.phases.map(phase => {
      const startDate = new Date(phase.startTime);
      const endDate = new Date(phase.endTime);
      const dateStr = `${startDate.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' })}`;

      const topPerformersStr = phase.topPerformers
        .slice(0, 3)
        .map(p => `${p.symbol} +${p.gain.toFixed(0)}%`)
        .join(', ');

      return `
        <div class="bull-phase-item">
          <div class="bull-phase-header">
            <span class="bull-phase-date">${dateStr}</span>
            <span class="bull-phase-btc positive">BTC +${phase.btcGain.toFixed(1)}%</span>
          </div>
          <div class="bull-phase-duration">${phase.duration}</div>
          <div class="bull-phase-top">
            <span class="bull-phase-top-label">Top:</span>
            <span class="bull-phase-top-tokens">${topPerformersStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  getTierInfo(score) {
    const tiers = MOMENTUM_CONFIG.TIERS;
    for (const [key, tier] of Object.entries(tiers)) {
      if (score >= tier.min) {
        return { ...tier, key };
      }
    }
    return tiers.F;
  }

  getTierDescription(tier) {
    const descMap = {
      S: 'tierS',
      A: 'tierA',
      B: 'tierB',
      C: 'tierC',
      D: 'tierD',
      F: 'tierF'
    };
    return this.t(descMap[tier] || 'tierF');
  }

  startAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }

    this.refreshInterval = setInterval(() => {
      this.loadData();
      this.loadMomentumData();
    }, CONFIG.REFRESH_INTERVAL);
  }

  stopAutoRefresh() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }
}

// Initialize app
window.app = new CryptoDashboard();
