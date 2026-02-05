/**
 * AI Helper - Groq Integration for Crypto Sectors
 * Анализ секторов и сигналов с помощью Llama 3.3
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

class AIHelper {
  constructor() {
    this.isAvailable = !!GROQ_API_KEY;
    if (!this.isAvailable) {
      console.log('[AI] GROQ_API_KEY not set, AI features disabled');
    } else {
      console.log('[AI] Initialized (Groq Llama 3.3)');
    }
  }

  // Отправить запрос к Groq API
  async chat(messages, options = {}) {
    if (!this.isAvailable) {
      throw new Error('AI не настроен. Добавьте GROQ_API_KEY в .env');
    }

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'llama-3.3-70b-versatile',
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 2000
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || `Groq API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  // ============= ДАЙДЖЕСТЫ =============

  // Ежедневный дайджест
  async generateDailyDigest(data) {
    const { sectors, signals, marketState, fearGreed } = data;

    const prompt = this.buildDailyPrompt(sectors, signals, marketState, fearGreed);

    const systemPrompt = `Ты — крипто-аналитик. Пишешь краткие, информативные дайджесты на русском языке.

Стиль:
- Конкретика, никакой воды
- Цифры и факты
- Actionable инсайты
- Используй эмодзи для структуры

Формат ежедневного дайджеста:
🌅 УТРЕННИЙ ОБЗОР [дата]

📊 Рынок: [состояние + Fear&Greed]

🔥 Горячие секторы (топ-3):
• Сектор: +X% — краткий комментарий

❄️ Холодные секторы (топ-2):
• Сектор: -X%

⚡ Ключевые сигналы:
• [тип] TOKEN — причина

🎯 На что смотреть сегодня:
1-2 конкретных идеи`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], { maxTokens: 1500 });

      return { success: true, digest: response };
    } catch (error) {
      console.error('[AI] Daily digest error:', error);
      return { success: false, error: error.message };
    }
  }

  // Еженедельный дайджест
  async generateWeeklyDigest(data) {
    const { sectors, signals, weeklyStats, momentum } = data;

    const prompt = this.buildWeeklyPrompt(sectors, signals, weeklyStats, momentum);

    const systemPrompt = `Ты — крипто-аналитик. Пишешь глубокие еженедельные обзоры на русском языке.

Стиль:
- Аналитический подход
- Выявление трендов и паттернов
- Прогнозы с обоснованием
- Конкретные рекомендации

Формат еженедельного дайджеста:
📅 НЕДЕЛЬНЫЙ ОБЗОР [даты]

📈 Итоги недели:
- Общая динамика рынка
- Ключевые цифры

🔄 Ротация капитала:
- Откуда уходят деньги
- Куда приходят
- Emerging narratives

🏆 Лидеры недели:
Топ-5 токенов с анализом почему

📉 Аутсайдеры:
Топ-3 с анализом причин

🔮 Прогноз на неделю:
- Какие секторы могут выстрелить
- Риски и возможности

💡 Торговые идеи:
2-3 конкретные идеи с обоснованием`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], { maxTokens: 2500 });

      return { success: true, digest: response };
    } catch (error) {
      console.error('[AI] Weekly digest error:', error);
      return { success: false, error: error.message };
    }
  }

  // ============= КОНТЕКСТНЫЕ ПОЯСНЕНИЯ =============

  // Объяснение сигнала
  async explainSignal(signal, sectorData) {
    const prompt = `Сигнал: ${signal.type}
Токен: ${signal.token || signal.sector}
Изменение 24ч: ${signal.change_24h?.toFixed(1) || 'N/A'}%
Сектор: ${signal.sector}
Данные сектора: ${sectorData ? `24h: ${sectorData.change_24h?.toFixed(1)}%, 7d: ${sectorData.change_7d?.toFixed(1)}%` : 'N/A'}

Объясни кратко (1-2 предложения) почему этот сигнал важен и что он означает для трейдера.`;

    try {
      const response = await this.chat([
        { role: 'system', content: 'Ты крипто-аналитик. Объясняй сигналы кратко и по делу на русском. Максимум 2 предложения.' },
        { role: 'user', content: prompt }
      ], { maxTokens: 200, temperature: 0.5 });

      return { success: true, explanation: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= ИНТЕРАКТИВНЫЙ АССИСТЕНТ =============

  // Ответ на вопрос с контекстом рынка
  async askQuestion(question, marketContext) {
    const systemPrompt = `Ты — AI-помощник для анализа крипторынка. Отвечай на русском языке.

Твои возможности:
- Анализ секторов и токенов
- Объяснение рыночных движений
- Торговые идеи (не финансовый совет)
- Анализ momentum и ротаций

Стиль: конкретный, data-driven, без воды.`;

    const userPrompt = `Текущий контекст рынка:
${marketContext}

Вопрос пользователя: ${question}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { maxTokens: 1000 });

      return { success: true, answer: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ============= HELPERS =============

  buildDailyPrompt(sectors, signals, marketState, fearGreed) {
    let prompt = `Дата: ${new Date().toLocaleDateString('ru-RU')}

СОСТОЯНИЕ РЫНКА:
- Market State: ${marketState || 'neutral'}
- Fear & Greed: ${fearGreed?.value || 'N/A'} (${fearGreed?.classification || 'N/A'})

СЕКТОРЫ (топ по 24h):
`;

    // Сортируем секторы по изменению
    const sortedSectors = [...sectors].sort((a, b) => (b.change_24h || 0) - (a.change_24h || 0));

    sortedSectors.slice(0, 5).forEach(s => {
      prompt += `• ${s.name}: ${s.change_24h > 0 ? '+' : ''}${s.change_24h?.toFixed(1) || 0}% (7d: ${s.change_7d > 0 ? '+' : ''}${s.change_7d?.toFixed(1) || 0}%)\n`;
    });

    prompt += `\nХУДШИЕ СЕКТОРЫ:\n`;
    sortedSectors.slice(-3).reverse().forEach(s => {
      prompt += `• ${s.name}: ${s.change_24h > 0 ? '+' : ''}${s.change_24h?.toFixed(1) || 0}%\n`;
    });

    if (signals && signals.length > 0) {
      prompt += `\nСИГНАЛЫ ЗА СЕГОДНЯ (${signals.length}):\n`;
      signals.slice(0, 10).forEach(s => {
        prompt += `• [${s.type}] ${s.token || s.sector}: ${s.reason || ''}\n`;
      });
    }

    return prompt;
  }

  buildWeeklyPrompt(sectors, signals, weeklyStats, momentum) {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    let prompt = `Период: ${weekAgo.toLocaleDateString('ru-RU')} — ${now.toLocaleDateString('ru-RU')}

ДИНАМИКА СЕКТОРОВ ЗА НЕДЕЛЮ:
`;

    // Сортируем по 7d изменению
    const sortedSectors = [...sectors].sort((a, b) => (b.change_7d || 0) - (a.change_7d || 0));

    sortedSectors.forEach(s => {
      const trend = s.change_7d > s.change_24h * 3 ? '📈 рост' :
                    s.change_7d < s.change_24h * 0.3 ? '📉 падение' : '➡️ боковик';
      prompt += `• ${s.name}: 7d ${s.change_7d > 0 ? '+' : ''}${s.change_7d?.toFixed(1) || 0}% | 24h ${s.change_24h > 0 ? '+' : ''}${s.change_24h?.toFixed(1) || 0}% | ${trend}\n`;
    });

    if (signals && signals.length > 0) {
      prompt += `\nСИГНАЛЫ ЗА НЕДЕЛЮ (${signals.length}):\n`;

      // Группируем по типу
      const byType = {};
      signals.forEach(s => {
        byType[s.type] = (byType[s.type] || 0) + 1;
      });

      Object.entries(byType).forEach(([type, count]) => {
        prompt += `• ${type}: ${count}\n`;
      });

      // Топ токены по сигналам
      const tokenSignals = {};
      signals.filter(s => s.token).forEach(s => {
        tokenSignals[s.token] = (tokenSignals[s.token] || 0) + 1;
      });

      const topTokens = Object.entries(tokenSignals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      if (topTokens.length > 0) {
        prompt += `\nТОКЕНЫ С НАИБОЛЬШИМ ЧИСЛОМ СИГНАЛОВ:\n`;
        topTokens.forEach(([token, count]) => {
          prompt += `• ${token}: ${count} сигналов\n`;
        });
      }
    }

    if (momentum && momentum.tokens) {
      prompt += `\nTOP MOMENTUM (исторически сильные на ралли):\n`;
      Object.entries(momentum.tokens)
        .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
        .slice(0, 5)
        .forEach(([token, data]) => {
          prompt += `• ${token}: Score ${data.score?.toFixed(0) || 0}, Tier ${data.tier || 'N/A'}\n`;
        });
    }

    return prompt;
  }

  // Статус AI
  getStatus() {
    return {
      available: this.isAvailable,
      model: 'llama-3.3-70b-versatile',
      provider: 'Groq'
    };
  }
}

// Singleton
const aiHelper = new AIHelper();

module.exports = aiHelper;
