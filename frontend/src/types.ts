export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  is_admin: boolean;
  is_blocked: boolean;
  is_restricted: boolean;
  last_active: string | null;
  created_at: string;
}

export type ForexSymbol = 'EUR/USD' | 'GBP/USD' | 'USD/JPY' | 'AUD/USD' | 'XAU/USD';
export type Timeframe = '15min' | '1h' | '4h' | '1day';

export type PlatformCategory = 'forex' | 'metals' | 'crypto' | 'stocks' | 'indices' | 'commodities' | 'copy';

export interface PlatformInstrument {
  symbol: string;
  name: string;
}

export interface PlatformCategoryDef {
  id: PlatformCategory;
  name: string;
  description: string;
  color: 'blue' | 'yellow' | 'purple' | 'green' | 'red' | 'orange' | 'teal' | 'indigo';
  icon: string;
  instruments: PlatformInstrument[];
}

export interface MarketInterestRow {
  symbol: string | null;
  category: string | null;
  views: string;
  unique_users: string;
}

export interface ToolUsageRow {
  tool: string | null;
  uses: string;
  unique_users: string;
}

export interface OnlineUser {
  id: number;
  email: string;
  name: string | null;
  last_active: string;
  is_blocked: boolean;
  is_restricted: boolean;
  created_at: string;
}

export interface User {
  id: number;
  email: string;
  name?: string;
  isAdmin?: boolean;
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
    support: number[];
    resistance: number[];
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
  fibLevels?: string;
  emaAlignment?: string;
  disclaimer: string;
  aiProvider: string;
  // Dual AI extended fields
  agreement?: boolean | null;
  providers_used?: string[];
  kelly_position_size?: string;
  confluence_score?: number;
  individual_results?: {
    claude?: { direction: string; confidence: number; reasoning: string; indicators?: Record<string, unknown> };
    groq?:   { direction: string; confidence: number; reasoning: string };
  };
  // Multi-AI consensus extended fields
  individual_results_list?: Array<{
    provider:   string;
    direction:  string;
    confidence: number;
    confluence: number;
    weight:     string;
  }>;
  indicator_votes?: Record<string, { BUY: number; SELL: number; NEUTRAL: number }>;
  failed_providers?: Array<{ provider: string; error: string }>;
  all_agreed?: boolean;
  providers_count?: number;
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
