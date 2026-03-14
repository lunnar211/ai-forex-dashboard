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

  const fmt = (n: number, decimals = 5) =>
    typeof n === 'number' ? n.toFixed(decimals) : '—';

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
