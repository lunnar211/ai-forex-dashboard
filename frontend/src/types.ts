export type ForexSymbol = 'EUR/USD' | 'GBP/USD' | 'USD/JPY' | 'AUD/USD' | 'XAU/USD';
export type Timeframe = '15min' | '1h' | '4h' | '1day';

export interface User {
  id: number;
  email: string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
  };
  ema: {
    ema20: number;
    ema50: number;
    ema200: number;
  };
  supportResistance: {
    support: number | number[];
    resistance: number | number[];
  };
  stochastic?: {
    k: number;
    d: number;
  };
  williamsR?: number;
  cci?: number;
  adx?: {
    adx: number;
    plusDI: number;
    minusDI: number;
  };
  fibonacci?: {
    high: number;
    low: number;
    levels: {
      fib0: number;
      fib236: number;
      fib382: number;
      fib500: number;
      fib618: number;
      fib786: number;
      fib100: number;
    };
  };
  atr: number;
  volumeTrend: string;
  currentPrice: number;
  priceChange: number;
  highLow: {
    high24h: number;
    low24h: number;
  };
}

export interface Prediction {
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  reasoning: string;
  keyRisks: string;
  marketBias: string;
  timeHorizon: string;
  disclaimer: string;
  aiProvider: string;
  buyReasons?: string[];
  sellReasons?: string[];
  nextSignalEta?: string;
}

export interface PredictResponse {
  predictionId: string;
  symbol: string;
  timeframe: string;
  isMockData: boolean;
  indicators: Indicators;
  prediction: Prediction;
  rateLimit: {
    remaining: number;
    resetInSeconds: number;
  };
  createdAt: string;
}

export interface HistoryRecord {
  id: number;
  symbol: string;
  timeframe: string;
  direction: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit: number;
  reasoning: string;
  ai_provider: string;
  created_at: string;
}

export interface Signal {
  symbol: string;
  direction: string;
  confidence: number;
  currentPrice: number;
  rsi: number;
  macdHistogram: number;
  marketBias: string;
  isMock: boolean;
}

export interface ChartAnalysis {
  symbol: string;
  patterns: string[];
  trend: string;
  direction: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  supportLevels: string[];
  resistanceLevels: string[];
  buyReasons: string[];
  sellReasons: string[];
  nextSignalEta: string;
  analysis: string;
  disclaimer: string;
  aiProvider: string;
  isMockAnalysis?: boolean;
}

export interface ApiKeyStatus {
  configured: boolean;
  masked: string | null;
}

export interface AdminStatus {
  apiKeys: {
    groq: ApiKeyStatus;
    openai: ApiKeyStatus;
    gemini: ApiKeyStatus;
    twelveData: ApiKeyStatus;
  };
  services: {
    database: string;
    redis: string;
    forexData: string;
  };
  environment: string;
}
