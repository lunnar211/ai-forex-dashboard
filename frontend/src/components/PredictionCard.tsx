'use client';
import clsx from 'clsx';
import type { Prediction, Indicators } from '../types';

interface Props {
  prediction: Prediction | null;
  indicators: Indicators | null;
  loading: boolean;
  symbol: string;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse bg-[#334155] rounded', className)} />;
}

function DirectionBadge({ direction }: { direction: 'BUY' | 'SELL' | 'HOLD' }) {
  const styles = {
    BUY: 'bg-[#166534] text-[#22c55e] border-[#22c55e]',
    SELL: 'bg-[#7f1d1d] text-[#ef4444] border-[#ef4444]',
    HOLD: 'bg-[#713f12] text-[#eab308] border-[#eab308]',
  };
  return (
    <span className={clsx('text-2xl font-black px-4 py-1.5 rounded-lg border-2', styles[direction])}>
      {direction}
    </span>
  );
}

function Row({ label, value, valueClass }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#334155] last:border-0">
      <span className="text-sm text-[#94a3b8]">{label}</span>
      <span className={clsx('text-sm font-semibold text-white', valueClass)}>{value}</span>
    </div>
  );
}

export default function PredictionCard({ prediction, indicators, loading, symbol }: Props) {
  if (loading) {
    return (
      <div className="bg-[#1e293b] rounded-xl p-6 space-y-4 border border-[#334155]">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!prediction) return null;

  const fmt = (n: number | number[] | undefined, decimals = 5) => {
    // Support/resistance may come back as arrays; display the first value
    if (typeof n === 'number') return n.toFixed(decimals);
    if (Array.isArray(n) && n.length > 0) return n[0].toFixed(decimals);
    return '—';
  };

  /** Convert Fibonacci key names like 'fib236' → '23.6%', 'fib0' → '0%', 'fib100' → '100%' */
  const fibLabel = (key: string): string => {
    const digits = key.replace('fib', '');
    if (digits === '0') return '0%';
    if (digits === '100') return '100%';
    if (digits.length === 3) return `${digits.slice(0, 1)}.${digits.slice(1)}%`;
    if (digits.length === 2) return `${digits}%`;
    return `${digits}%`;
  };

  return (
    <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#334155]">
        <div>
          <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">AI Signal for {symbol}</p>
          <DirectionBadge direction={prediction.direction as 'BUY' | 'SELL' | 'HOLD'} />
        </div>
        <div className="text-right">
          <p className="text-xs text-[#94a3b8] mb-1">Confidence</p>
          <p className="text-3xl font-black text-white">{prediction.confidence}%</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="px-6 py-3 border-b border-[#334155]">
        <div className="w-full bg-[#0f172a] rounded-full h-2.5">
          <div
            className={clsx(
              'h-2.5 rounded-full transition-all duration-500',
              prediction.direction === 'BUY' ? 'bg-[#22c55e]' :
              prediction.direction === 'SELL' ? 'bg-[#ef4444]' : 'bg-[#eab308]'
            )}
            style={{ width: `${Math.min(100, prediction.confidence)}%` }}
          />
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Price targets */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Entry Price', value: fmt(prediction.entryPrice), color: 'text-blue-400' },
            { label: 'Stop Loss', value: fmt(prediction.stopLoss), color: 'text-[#ef4444]' },
            { label: 'Take Profit', value: fmt(prediction.takeProfit), color: 'text-[#22c55e]' },
          ].map((item) => (
            <div key={item.label} className="bg-[#0f172a] rounded-lg p-3 text-center">
              <p className="text-xs text-[#94a3b8] mb-1">{item.label}</p>
              <p className={clsx('text-sm font-bold font-mono', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>

        {/* Key metrics */}
        <div className="bg-[#0f172a] rounded-lg p-4 space-y-0">
          <Row label="Risk / Reward" value={`1 : ${prediction.riskRewardRatio?.toFixed(2) ?? '—'}`} />
          <Row label="Time Horizon" value={prediction.timeHorizon} />
          <Row label="Market Bias" value={prediction.marketBias} />
          <Row label="AI Provider" value={prediction.aiProvider}
            valueClass="text-blue-400" />
          {indicators && (
            <>
              <Row label="RSI" value={indicators.rsi?.toFixed(2) ?? '—'}
                valueClass={indicators.rsi > 70 ? 'text-[#ef4444]' : indicators.rsi < 30 ? 'text-[#22c55e]' : 'text-white'} />
              <Row label="MACD Histogram"
                value={indicators.macd?.histogram?.toFixed(5) ?? '—'}
                valueClass={indicators.macd?.histogram >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'} />
              <Row label="Volume Trend" value={indicators.volumeTrend ?? '—'} />
              <Row label="ATR" value={indicators.atr?.toFixed(5) ?? '—'} />
            </>
          )}
        </div>

        {/* Buy / Sell Reasons */}
        {((prediction.buyReasons && prediction.buyReasons.length > 0) ||
          (prediction.sellReasons && prediction.sellReasons.length > 0)) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {prediction.buyReasons && prediction.buyReasons.length > 0 && (
              <div className="bg-[#0f172a] rounded-lg p-4 border-l-2 border-[#22c55e]">
                <p className="text-xs font-semibold text-[#22c55e] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  Why BUY
                </p>
                <ul className="space-y-1.5">
                  {prediction.buyReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#cbd5e1]">
                      <span className="text-[#22c55e] mt-0.5 flex-shrink-0">✓</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {prediction.sellReasons && prediction.sellReasons.length > 0 && (
              <div className="bg-[#0f172a] rounded-lg p-4 border-l-2 border-[#ef4444]">
                <p className="text-xs font-semibold text-[#ef4444] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  Why SELL
                </p>
                <ul className="space-y-1.5">
                  {prediction.sellReasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[#cbd5e1]">
                      <span className="text-[#ef4444] mt-0.5 flex-shrink-0">✗</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Next Signal ETA */}
        {prediction.nextSignalEta && (
          <div className="bg-[#0f172a] rounded-lg p-4 border border-[#334155] flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⏱</span>
            <div>
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">Next Signal</p>
              <p className="text-sm text-[#cbd5e1]">{prediction.nextSignalEta}</p>
            </div>
          </div>
        )}

        {/* Indicators deep dive */}
        {indicators && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Support / Resistance */}
            <div className="bg-[#0f172a] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                Support / Resistance
              </p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Resistance</span>
                  <span className="font-mono text-[#ef4444]">
                    {fmt(indicators.supportResistance?.resistance)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Support</span>
                  <span className="font-mono text-[#22c55e]">
                    {fmt(indicators.supportResistance?.support)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bollinger Bands */}
            <div className="bg-[#0f172a] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                Bollinger Bands
              </p>
              <div className="space-y-1">
                {[
                  { label: 'Upper', val: indicators.bollinger?.upper, cls: 'text-[#ef4444]' },
                  { label: 'Middle', val: indicators.bollinger?.middle, cls: 'text-white' },
                  { label: 'Lower', val: indicators.bollinger?.lower, cls: 'text-[#22c55e]' },
                ].map(({ label, val, cls }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">{label}</span>
                    <span className={clsx('font-mono', cls)}>{fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* EMA */}
            <div className="bg-[#0f172a] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">EMA</p>
              <div className="space-y-1">
                {[
                  { label: 'EMA 20', val: indicators.ema?.ema20 },
                  { label: 'EMA 50', val: indicators.ema?.ema50 },
                  { label: 'EMA 200', val: indicators.ema?.ema200 },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">{label}</span>
                    <span className="font-mono text-blue-400">{fmt(val)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 24h Range */}
            <div className="bg-[#0f172a] rounded-lg p-4">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">24h Range</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">High</span>
                  <span className="font-mono text-[#22c55e]">{fmt(indicators.highLow?.high24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Low</span>
                  <span className="font-mono text-[#ef4444]">{fmt(indicators.highLow?.low24h)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#94a3b8]">Change</span>
                  <span className={clsx('font-mono', (indicators.priceChange ?? 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
                    {(indicators.priceChange ?? 0) >= 0 ? '+' : ''}{(indicators.priceChange ?? 0).toFixed(4)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Extended indicators: Stochastic, Williams %R, CCI, ADX */}
        {indicators && (indicators.stochastic || indicators.adx || indicators.fibonacci) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {indicators.stochastic && (
              <div className="bg-[#0f172a] rounded-lg p-4">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Stochastic</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">%K</span>
                    <span className={clsx('font-mono', (indicators.stochastic.k || 50) > 80 ? 'text-[#ef4444]' : (indicators.stochastic.k || 50) < 20 ? 'text-[#22c55e]' : 'text-white')}>
                      {indicators.stochastic.k?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">%D</span>
                    <span className="font-mono text-blue-400">{indicators.stochastic.d?.toFixed(2)}</span>
                  </div>
                  {typeof indicators.williamsR === 'number' && (
                    <div className="flex justify-between text-sm pt-1 border-t border-[#1e293b]">
                      <span className="text-[#94a3b8]">Williams %R</span>
                      <span className={clsx('font-mono', (indicators.williamsR || -50) > -20 ? 'text-[#ef4444]' : (indicators.williamsR || -50) < -80 ? 'text-[#22c55e]' : 'text-white')}>
                        {indicators.williamsR?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {typeof indicators.cci === 'number' && (
                    <div className="flex justify-between text-sm">
                      <span className="text-[#94a3b8]">CCI (20)</span>
                      <span className={clsx('font-mono', (indicators.cci || 0) > 100 ? 'text-[#ef4444]' : (indicators.cci || 0) < -100 ? 'text-[#22c55e]' : 'text-white')}>
                        {indicators.cci?.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {indicators.adx && (
              <div className="bg-[#0f172a] rounded-lg p-4">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">
                  ADX — Trend Strength
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">ADX</span>
                    <span className={clsx('font-mono font-bold', (indicators.adx.adx || 0) > 25 ? 'text-white' : 'text-[#475569]')}>
                      {indicators.adx.adx?.toFixed(2)}
                      <span className="ml-1 text-xs text-[#475569]">
                        {(indicators.adx.adx || 0) > 50 ? '(Very Strong)' : (indicators.adx.adx || 0) > 25 ? '(Strong)' : '(Ranging)'}
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">+DI</span>
                    <span className="font-mono text-[#22c55e]">{indicators.adx.plusDI?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94a3b8]">-DI</span>
                    <span className="font-mono text-[#ef4444]">{indicators.adx.minusDI?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
            {indicators.fibonacci?.levels && (
              <div className="bg-[#0f172a] rounded-lg p-4 md:col-span-2">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Fibonacci Retracement</p>
                <div className="grid grid-cols-3 md:grid-cols-7 gap-2">
                  {Object.entries(indicators.fibonacci.levels).map(([key, val]) => (
                    <div key={key} className="text-center">
                      <p className="text-[10px] text-[#475569]">{fibLabel(key)}</p>
                      <p className="text-xs font-mono text-blue-300">{typeof val === 'number' ? val.toFixed(4) : '—'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reasoning */}
        <div className="bg-[#0f172a] rounded-lg p-4">
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">AI Reasoning</p>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{prediction.reasoning}</p>
        </div>

        {/* Key Risks */}
        <div className="bg-[#0f172a] rounded-lg p-4 border-l-2 border-[#eab308]">
          <p className="text-xs font-semibold text-[#eab308] uppercase tracking-wider mb-2">Key Risks</p>
          <p className="text-sm text-[#cbd5e1] leading-relaxed">{prediction.keyRisks}</p>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-[#475569] text-center">
          ⚠️ For educational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
