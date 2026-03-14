'use strict';

const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');

let groqClient = null;

function getGroqClient() {
  if (!groqClient && process.env.GROQ_API_KEY) {
    groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groqClient;
}

const ANALYSIS_PROMPT = `You are a professional forex chart analyst. Analyse this trading chart image and provide:
1. What pattern(s) do you see? (e.g. head and shoulders, double top, flag, wedge, etc.)
2. Key support and resistance levels visible on the chart.
3. Trend direction (bullish / bearish / sideways).
4. A BUY, SELL, or HOLD recommendation based on the chart pattern alone.
5. Confidence level (0–100).
6. 2–4 specific buy reasons.
7. 2–4 specific sell reasons.
8. Estimated next signal timing.

Respond ONLY with valid JSON:
{
  "patterns": ["<pattern1>", "<pattern2>"],
  "trend": "BULLISH" | "BEARISH" | "SIDEWAYS",
  "direction": "BUY" | "SELL" | "HOLD",
  "confidence": <number 0-100>,
  "supportLevels": ["<level1>", "<level2>"],
  "resistanceLevels": ["<level1>", "<level2>"],
  "buyReasons": ["<reason1>", "<reason2>"],
  "sellReasons": ["<reason1>", "<reason2>"],
  "nextSignalEta": "<description>",
  "analysis": "<2-3 sentence professional analysis>",
  "disclaimer": "For educational purposes only. Not financial advice."
}`;

// POST /upload/analyze
async function analyzeChart(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided.' });
  }

  const { symbol = 'Unknown' } = req.body;
  const filePath = req.file.path;

  try {
    const client = getGroqClient();

    if (!client) {
      // No AI available — return a mock structural response
      fs.unlink(filePath, () => {});
      return res.json({
        symbol,
        patterns: ['Chart uploaded successfully'],
        trend: 'NEUTRAL',
        direction: 'HOLD',
        confidence: 50,
        supportLevels: ['Identify visually from chart'],
        resistanceLevels: ['Identify visually from chart'],
        buyReasons: ['Configure GROQ_API_KEY for AI-powered chart analysis'],
        sellReasons: ['Configure GROQ_API_KEY for AI-powered chart analysis'],
        nextSignalEta: 'AI analysis unavailable — set up API keys in Settings',
        analysis: 'Chart received. Configure an AI API key in Settings to enable automated chart pattern analysis.',
        disclaimer: 'For educational purposes only. Not financial advice.',
        aiProvider: 'none',
        isMockAnalysis: true,
      });
    }

    // Read the file and convert to base64
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    let content;
    try {
      // Use Groq vision model (llama-3.2-11b-vision-preview supports images)
      const completion = await client.chat.completions.create({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Instrument: ${symbol}\n\n${ANALYSIS_PROMPT}`,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      });
      content = completion.choices[0]?.message?.content || '';
    } finally {
      // Always clean up the temp file after the API call completes (success or failure)
      fs.unlink(filePath, () => {});
    }

    const cleaned = content.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) {
        return res.json({
          symbol,
          patterns: [],
          trend: 'NEUTRAL',
          direction: 'HOLD',
          confidence: 50,
          supportLevels: [],
          resistanceLevels: [],
          buyReasons: [],
          sellReasons: [],
          nextSignalEta: 'Unable to parse AI response',
          analysis: cleaned.slice(0, 500),
          disclaimer: 'For educational purposes only. Not financial advice.',
          aiProvider: 'groq',
        });
      }
      parsed = JSON.parse(match[0]);
    }

    return res.json({
      symbol,
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      trend: parsed.trend || 'NEUTRAL',
      direction: ['BUY', 'SELL', 'HOLD'].includes(parsed.direction) ? parsed.direction : 'HOLD',
      confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 50)),
      supportLevels: Array.isArray(parsed.supportLevels) ? parsed.supportLevels : [],
      resistanceLevels: Array.isArray(parsed.resistanceLevels) ? parsed.resistanceLevels : [],
      buyReasons: Array.isArray(parsed.buyReasons) ? parsed.buyReasons : [],
      sellReasons: Array.isArray(parsed.sellReasons) ? parsed.sellReasons : [],
      nextSignalEta: parsed.nextSignalEta || 'Monitor chart for next setup',
      analysis: parsed.analysis || 'Analysis completed.',
      disclaimer: 'For educational purposes only. Not financial advice.',
      aiProvider: 'groq',
    });
  } catch (err) {
    // Cleanup temp file on error
    fs.unlink(filePath, () => {});
    console.error('[UploadController] analyzeChart error:', err.message);
    return res.status(500).json({ error: 'Failed to analyse chart. Please try again.' });
  }
}

module.exports = { analyzeChart };
