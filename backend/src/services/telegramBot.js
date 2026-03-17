'use strict';

const { Telegraf } = require('telegraf');
const axios = require('axios');
const { generateMultiAIPrediction } = require('./multiAIEngine');
const { getLiveQuote, getForexNews } = require('./marketDataService');
const { pool } = require('../config/database');

const VALID_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD',
  'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'EUR/JPY',
  'GBP/JPY', 'XAG/USD',
];

const VALID_TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'];

// Convert EURUSD → EUR/USD
function normalizeSymbol(input) {
  const s = input.toUpperCase().trim();
  if (s.includes('/')) return VALID_SYMBOLS.includes(s) ? s : null;
  const withSlash = s.slice(0, 3) + '/' + s.slice(3);
  return VALID_SYMBOLS.includes(withSlash) ? withSlash : null;
}

// Format prediction as Telegram message
function formatPrediction(pred, symbol, timeframe) {
  if (pred.setup === false) {
    return (
      `⚠️ No Trade Setup — ${symbol}\n\n` +
      `Reason: ${pred.reason || 'Confluence too low'}\n` +
      `Watch level: ${pred.next_level_to_watch || 'N/A'}\n` +
      `Sentiment: ${pred.market_sentiment || 'NEUTRAL'}`
    );
  }

  const dir = pred.direction;
  const emoji = dir === 'BUY' ? '📈' : dir === 'SELL' ? '📉' : '↔️';
  const agree = pred.all_agreed
    ? '✅ All AIs Agree — High Confidence'
    : '⚠️ AIs Disagree — Trade with Caution';

  let individualResults = '';
  if (pred.individual_results?.length) {
    individualResults =
      '\n🤖 AI Votes:\n' +
      pred.individual_results
        .map(
          (r) =>
            `  ${r.direction === 'BUY' ? '🟢' : r.direction === 'SELL' ? '🔴' : '🟡'} ${r.provider.padEnd(10)} ${r.direction} ${r.confidence}%`
        )
        .join('\n');
  }

  return (
    `════════════════════════\n` +
    `${emoji} *${symbol} — ${timeframe} Analysis*\n` +
    `════════════════════════\n` +
    `📊 Signal:      *${dir}*\n` +
    `💯 Confidence:  *${pred.confidence}%*\n` +
    `🎯 Entry:       \`${pred.entry_price}\`\n` +
    `🛑 Stop Loss:   \`${pred.stop_loss}\`\n` +
    `✅ TP1:         \`${pred.take_profit_1}\`\n` +
    `✅ TP2:         \`${pred.take_profit_2}\`\n` +
    `⚖️ R:R Ratio:   *${pred.risk_reward_ratio}*\n` +
    `🏆 Confluence:  *${pred.confluence_score}%*\n` +
    `════════════════════════${individualResults}\n` +
    `════════════════════════\n` +
    `${agree}\n` +
    `⏰ ${new Date().toUTCString()}`
  );
}

function createBot() {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('[Bot] TELEGRAM_BOT_TOKEN not set — Telegram bot disabled.');
    return null;
  }

  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

  // ── COMMANDS ──────────────────────────────────────────────────────

  bot.start((ctx) =>
    ctx.replyWithMarkdown(
      `🤖 *Welcome to ForexAI Terminal!*\n\n` +
      `I use *5 AI models* simultaneously for maximum accuracy.\n\n` +
      `📊 *Trading:*\n` +
      `/predict EURUSD 1h — Full AI prediction\n` +
      `/signal GBPUSD — Quick signal\n` +
      `/price XAUUSD — Live price\n` +
      `/analyse — Send chart image for AI analysis\n\n` +
      `📰 *Market Data:*\n` +
      `/news EURUSD — Latest news\n` +
      `/sentiment EURUSD — Market sentiment\n\n` +
      `🔔 *Alerts:*\n` +
      `/subscribe — Live signals every hour\n` +
      `/symbols — All valid pairs\n\n` +
      `👤 *Account:*\n` +
      `/register — Create account\n` +
      `/dashboard — Open dashboard\n\n` +
      `Type /help for full list.\n\n` +
      `☕ Support us: https://ko-fi.com/dipeshkarki`
    )
  );

  bot.help((ctx) =>
    ctx.replyWithMarkdown(
      `📋 *All Commands:*\n\n` +
      `*Trading:*\n` +
      `/predict EURUSD 1h — AI prediction\n` +
      `/signal GBPUSD — Quick signal\n` +
      `/price EURUSD — Live price\n` +
      `/chart EURUSD — Chart link\n` +
      `/analyse — Image analysis\n\n` +
      `*News:*\n` +
      `/news EURUSD — Latest news\n` +
      `/sentiment EURUSD — Sentiment\n\n` +
      `*Alerts:*\n` +
      `/subscribe — Auto signals\n` +
      `/unsubscribe — Stop signals\n\n` +
      `*Info:*\n` +
      `/symbols — Valid pairs\n` +
      `/timeframes — Valid timeframes\n` +
      `/status — System status\n` +
      `/ping — Response test\n\n` +
      `*Account:*\n` +
      `/register — Sign up\n` +
      `/dashboard — Dashboard link\n` +
      `/history — Your predictions\n\n` +
      `*Support:*\n` +
      `/support — Support us on Ko-fi ☕\n\n` +
      `☕ Ko-fi: https://ko-fi.com/dipeshkarki`
    )
  );

  bot.command('support', (ctx) =>
    ctx.replyWithMarkdown(
      `☕ *Support ForexAI Terminal*\n\n` +
      `This bot is *completely FREE*.\n` +
      `If our AI signals help your trading,\n` +
      `please consider supporting us!\n\n` +
      `☕ *Ko-fi:* https://ko-fi.com/dipeshkarki\n\n` +
      `Every coffee keeps the AI running 24/7.\n` +
      `Thank you! 🙏`
    )
  );

  bot.command('symbols', (ctx) =>
    ctx.reply('📊 Valid Trading Pairs:\n\n' + VALID_SYMBOLS.join('\n'))
  );

  bot.command('timeframes', (ctx) =>
    ctx.reply('⏱ Valid Timeframes:\n\n1m  5m  15m  1h  4h  1d')
  );

  bot.command('ping', (ctx) => {
    const start = Date.now();
    ctx.reply(`🏓 Pong! Response time: ${Date.now() - start}ms`);
  });

  bot.command('register', (ctx) =>
    ctx.reply(
      '📝 Create your ForexAI account:\n\nhttps://ai-forex-frontend.onrender.com/register'
    )
  );

  bot.command('dashboard', (ctx) =>
    ctx.reply(
      '📊 Open your dashboard:\n\nhttps://ai-forex-frontend.onrender.com/dashboard'
    )
  );

  bot.command('status', async (ctx) => {
    const checks = [
      ['Claude API',  !!process.env.ANTHROPIC_API_KEY],
      ['Groq API',    !!process.env.GROQ_API_KEY],
      ['OpenAI API',  !!process.env.OPENAI_API_KEY],
      ['Gemini API',  !!process.env.GEMINI_API_KEY],
      ['Finnhub',     !!process.env.FINNHUB_API_KEY],
      ['NewsData',    !!process.env.NEWSDATA_API_KEY],
      ['Database',    true],
    ];
    const lines = checks.map(([name, ok]) => `${ok ? '🟢' : '🔴'} ${name}`);
    ctx.reply('⚙️ System Status:\n─────────────────\n' + lines.join('\n'));
  });

  bot.command('price', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.reply('Usage: /price EURUSD');
    const symbol = normalizeSymbol(args[0]);
    if (!symbol) return ctx.reply('Invalid symbol. Use /symbols to see valid pairs.');

    ctx.reply('⏳ Fetching live price...');
    try {
      const quote = await getLiveQuote(symbol);
      if (!quote) return ctx.reply('Price data unavailable. Try again later.');
      const change =
        quote.change >= 0
          ? `▲ +${quote.change_pct}%`
          : `▼ ${quote.change_pct}%`;
      ctx.replyWithMarkdown(
        `💱 *${symbol} Live Price*\n` +
        `─────────────────────\n` +
        `💰 Price:  \`${quote.current_price}\`\n` +
        `${change}\n` +
        `🔼 High:   \`${quote.high}\`\n` +
        `🔽 Low:    \`${quote.low}\`\n` +
        `📊 Source: Finnhub Live\n` +
        `⏰ ${new Date().toUTCString()}`
      );
    } catch (err) {
      ctx.reply('Error fetching price: ' + err.message);
    }
  });

  bot.command('news', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const symbol = args[0] ? normalizeSymbol(args[0]) : 'EUR/USD';
    if (!symbol) return ctx.reply('Invalid symbol. Use /symbols to see valid pairs.');

    ctx.reply('⏳ Fetching latest news...');
    try {
      const news = await getForexNews(symbol);
      if (!news?.articles?.length) return ctx.reply('No news found right now.');
      const lines = news.articles.map(
        (a, i) => `${i + 1}. [${a.sentiment}] ${a.title}`
      );
      ctx.reply(`📰 ${symbol} News:\n─────────────────\n${lines.join('\n\n')}`);
    } catch (err) {
      ctx.reply('Error fetching news: ' + err.message);
    }
  });

  bot.command('predict', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args[0])
      return ctx.reply('Usage: /predict EURUSD 1h\nTimeframes: 1m 5m 15m 1h 4h 1d');

    const symbol = normalizeSymbol(args[0]);
    const timeframe = args[1] || '1h';

    if (!symbol) return ctx.reply('Invalid symbol. Use /symbols to see valid pairs.');
    if (!VALID_TIMEFRAMES.includes(timeframe)) {
      return ctx.reply('Invalid timeframe. Use: 1m 5m 15m 1h 4h 1d');
    }

    await ctx.replyWithMarkdown(
      '🔄 *Running 5 AI models simultaneously...*\nThis takes 10-20 seconds.'
    );

    try {
      const prediction = await generateMultiAIPrediction(symbol, timeframe);

      // Save to database (non-fatal)
      pool
        .query(
          `INSERT INTO predictions
             (symbol, timeframe, direction, confidence, entry_price,
              stop_loss, take_profit, reasoning, ai_provider)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            symbol,
            timeframe,
            prediction.direction,
            prediction.confidence,
            prediction.entry_price,
            prediction.stop_loss,
            prediction.take_profit_1,
            prediction.reasoning,
            'telegram_multi',
          ]
        )
        .catch((dbErr) =>
          console.error('[Bot] DB save error:', dbErr.message)
        );

      ctx.replyWithMarkdown(formatPrediction(prediction, symbol, timeframe));
    } catch (err) {
      ctx.reply('Prediction failed: ' + err.message);
    }
  });

  bot.command('signal', async (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args[0]) return ctx.reply('Usage: /signal EURUSD');
    const symbol = normalizeSymbol(args[0]);
    if (!symbol) return ctx.reply('Invalid symbol. Use /symbols to see valid pairs.');

    ctx.reply('⏳ Getting signal...');
    try {
      const prediction = await generateMultiAIPrediction(symbol, '1h');
      const dir = prediction.direction;
      const emoji = dir === 'BUY' ? '📈' : dir === 'SELL' ? '📉' : '↔️';
      ctx.replyWithMarkdown(
        `${emoji} *Quick Signal — ${symbol}*\n` +
        `─────────────────────\n` +
        `Signal: *${dir}*\n` +
        `Confidence: *${prediction.confidence}%*\n` +
        `Entry: \`${prediction.entry_price}\`\n` +
        `SL: \`${prediction.stop_loss}\`\n` +
        `TP: \`${prediction.take_profit_1}\`\n\n` +
        `Use /predict ${symbol.replace('/', '')} 1h for full analysis`
      );
    } catch (err) {
      ctx.reply('Signal failed: ' + err.message);
    }
  });

  bot.command('chart', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    const symbol = args[0] ? normalizeSymbol(args[0]) : 'EUR/USD';
    if (!symbol) return ctx.reply('Invalid symbol. Use /symbols to see valid pairs.');
    const tvSymbol = symbol.replace('/', '');
    ctx.reply(
      `📊 ${symbol} Chart:\n` +
      `https://www.tradingview.com/chart/?symbol=FX:${tvSymbol}\n\n` +
      `Or view on dashboard:\n` +
      `https://ai-forex-frontend.onrender.com/platforms`
    );
  });

  bot.command('subscribe', async (ctx) => {
    const userId = ctx.from.id;
    try {
      await pool.query(
        `INSERT INTO telegram_subscribers (telegram_id, username, subscribed_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (telegram_id) DO UPDATE SET subscribed_at = NOW()`,
        [userId, ctx.from.username || '']
      );
      ctx.reply(
        '✅ Subscribed to live signals!\n\nYou will receive AI trading signals every hour.\nType /unsubscribe to stop anytime.'
      );
    } catch (err) {
      console.error('[Bot] Subscribe error:', err.message);
      ctx.reply('⚠️ Could not save your subscription. Please try again later.');
    }
  });

  bot.command('unsubscribe', async (ctx) => {
    const userId = ctx.from.id;
    try {
      await pool.query(
        'DELETE FROM telegram_subscribers WHERE telegram_id = $1',
        [userId]
      );
    } catch {
      // ignore
    }
    ctx.reply(
      '✅ Unsubscribed. You will no longer receive automatic signals.'
    );
  });

  bot.command('history', async (ctx) => {
    try {
      const { rows } = await pool.query(
        `SELECT symbol, timeframe, direction, confidence, created_at
         FROM predictions
         ORDER BY created_at DESC LIMIT 10`
      );
      if (!rows.length) return ctx.reply('No prediction history yet.');
      const lines = rows.map(
        (r, i) =>
          `${i + 1}. ${r.symbol} ${r.timeframe} — ${r.direction} (${r.confidence}%)`
      );
      ctx.reply(
        '📜 Recent Predictions:\n─────────────────\n' + lines.join('\n')
      );
    } catch {
      ctx.reply('Could not fetch history.');
    }
  });

  // Image analysis — user sends photo
  bot.on('photo', async (ctx) => {
    ctx.reply('🔄 Analysing your chart image with AI...');
    try {
      const fileId =
        ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const fileLink = await ctx.telegram.getFileLink(fileId);
      const imageRes = await axios.get(fileLink.href, {
        responseType: 'arraybuffer',
      });
      const base64 = Buffer.from(imageRes.data).toString('base64');
      const backendUrl =
        process.env.BACKEND_URL || 'http://localhost:5000';
      const analysisRes = await axios.post(
        `${backendUrl}/api/analysis/signal-base64`,
        { image: base64, mimeType: 'image/jpeg' }
      );
      const a = analysisRes.data?.analysis;
      if (!a) return ctx.reply('Analysis returned no result. Try again.');
      ctx.replyWithMarkdown(
        `📊 *Chart Analysis Result*\n` +
        `─────────────────────\n` +
        `Signal: *${a.direction || 'N/A'}*\n` +
        `Confidence: *${a.confidence || 'N/A'}%*\n` +
        `Entry: \`${a.entry_price || 'N/A'}\`\n` +
        `SL: \`${a.stop_loss || 'N/A'}\`\n` +
        `TP: \`${a.take_profit || 'N/A'}\`\n\n` +
        `${a.reasoning || ''}`
      );
    } catch (err) {
      ctx.reply('Image analysis failed: ' + err.message);
    }
  });

  return bot;
}

/**
 * Starts the Telegram bot (long-polling).
 * Safe to call even if TELEGRAM_BOT_TOKEN is not set.
 */
async function startBot() {
  const bot = createBot();
  if (!bot) return;

  try {
    await bot.launch();
    console.log('[Bot] Telegram bot launched successfully.');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (err) {
    console.error('[Bot] Failed to launch Telegram bot:', err.message);
  }
}

module.exports = { startBot };
