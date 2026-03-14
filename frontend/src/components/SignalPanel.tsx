'use client';
import clsx from 'clsx';
import type { Signal } from '../types';

interface Props {
  signal: Signal;
}

const directionStyles = {
  BUY: 'bg-[#166534] text-[#22c55e] border-[#22c55e]',
  SELL: 'bg-[#7f1d1d] text-[#ef4444] border-[#ef4444]',
  HOLD: 'bg-[#713f12] text-[#eab308] border-[#eab308]',
};

export default function SignalPanel({ signal }: Props) {
  const direction = (signal.direction?.toUpperCase() ?? 'HOLD') as keyof typeof directionStyles;
  const styleKey = directionStyles[direction] ?? directionStyles.HOLD;

  const rsiColor =
    (signal.rsi ?? 50) < 30 ? 'text-[#22c55e]' :
    (signal.rsi ?? 50) > 70 ? 'text-[#ef4444]' :
    'text-[#eab308]';

  const confPct = Math.min(100, Math.max(0, signal.confidence));

  return (
    <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 flex flex-col gap-4 hover:border-[#475569] transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-bold text-white">{signal.symbol}</p>
          {signal.isMock && (
            <span className="text-[10px] font-medium text-[#475569] bg-[#0f172a] px-1.5 py-0.5 rounded">
              MOCK
            </span>
          )}
        </div>
        <span className={clsx('text-sm font-black px-3 py-1 rounded-lg border-2', styleKey)}>
          {direction}
        </span>
      </div>

      {/* Error state */}
      {signal.error && (
        <div className="text-xs text-[#ef4444] bg-[#7f1d1d] rounded px-2 py-1">
          Error: {signal.error}
        </div>
      )}

      {/* Price */}
      <div className="text-center">
        <p className="text-2xl font-mono font-bold text-white">
          {signal.currentPrice != null ? signal.currentPrice.toFixed(5) : '—'}
        </p>
        <p className="text-xs text-[#94a3b8]">Current Price</p>
      </div>

      {/* Confidence */}
      <div>
        <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
          <span>Confidence</span>
          <span className="font-semibold text-white">{confPct}%</span>
        </div>
        <div className="w-full bg-[#0f172a] rounded-full h-2">
          <div
            className={clsx(
              'h-2 rounded-full transition-all duration-500',
              direction === 'BUY' ? 'bg-[#22c55e]' :
              direction === 'SELL' ? 'bg-[#ef4444]' : 'bg-[#eab308]'
            )}
            style={{ width: `${confPct}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-[#0f172a] rounded-lg p-2.5 text-center">
          <p className="text-[#94a3b8] text-xs">RSI</p>
          <p className={clsx('font-bold font-mono', rsiColor)}>
            {signal.rsi?.toFixed(1) ?? '—'}
          </p>
        </div>
        <div className="bg-[#0f172a] rounded-lg p-2.5 text-center">
          <p className="text-[#94a3b8] text-xs">MACD Hist</p>
          <p className={clsx('font-bold font-mono text-xs',
            (signal.macdHistogram ?? 0) >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'
          )}>
            {signal.macdHistogram !== undefined
              ? (signal.macdHistogram >= 0 ? '+' : '') + signal.macdHistogram.toFixed(5)
              : '—'}
          </p>
        </div>
      </div>

      {/* Market bias */}
      <div className="bg-[#0f172a] rounded-lg px-3 py-2 text-xs text-center">
        <span className="text-[#94a3b8]">Bias: </span>
        <span className="font-semibold text-white">{signal.marketBias || '—'}</span>
      </div>
    </div>
  );
}
