'use client';
import clsx from 'clsx';
import type { Prediction, Indicators } from '../types';

interface Props {
  prediction: Prediction | null;
  indicators: Indicators | null;
  loading: boolean;
  symbol: string | null;
}

const PROVIDER_ABBR: Record<string, string> = {
  groq:          'GQ',
  openai:        'OA',
  gemini:        'GM',
  deepseek:      'DS',
  'deepseek-r1': 'DR',
  claude:        'CL',
  anthropic:     'AN',
  mistral:       'MS',
  openrouter:    'OR',
  huggingface:   'HF',
  cohere:        'CO',
};

function ConfBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex-1 bg-[#0f172a] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-1.5 rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, pct))}%`, backgroundColor: color }}
      />
    </div>
  );
}

function fmtPrice(n?: number | null, digits = 5): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(digits);
}

/**
 * AIPredictionPanel — enhanced prediction results display.
 *
 * Replaces the basic PredictionCard on the platforms page with a richer layout
 * that shows per-provider votes, trade plan (Entry/SL/TP), and an AI
 * explanation.  Receives the same `prediction` object returned by the
 * `/api/ai/predict` endpoint (no extra API calls needed).
 */
export default function AIPredictionPanel({ prediction, loading, symbol }: Props) {
  const dir = prediction?.direction?.toUpperCase() ?? '';

  const signalColor =
    dir === 'BUY'  ? '#00ff88' :
    dir === 'SELL' ? '#ff4444' : '#ffaa00';

  const signalBorderClass =
    dir === 'BUY'  ? 'border-[#00ff88]/30 shadow-[0_0_24px_rgba(0,255,136,0.08)]' :
    dir === 'SELL' ? 'border-[#ff4444]/30 shadow-[0_0_24px_rgba(255,68,68,0.08)]' :
    dir === 'HOLD' ? 'border-[#ffaa00]/30 shadow-[0_0_24px_rgba(255,170,0,0.08)]' :
    'border-[#334155]';

  const signalLabel =
    dir === 'BUY'  ? 'STRONG BUY'  :
    dir === 'SELL' ? 'STRONG SELL' :
    dir === 'HOLD' ? 'HOLD'        : '—';

  return (
    <div className={clsx(
      'bg-[#0f172a] border rounded-2xl overflow-hidden transition-all duration-300',
      prediction ? signalBorderClass : 'border-[#334155]'
    )}>

      {/* Loading skeleton */}
      {loading && (
        <div className="p-5 space-y-4">
          {[80, 60, 70, 50].map((w, i) => (
            <div
              key={i}
              className="h-4 bg-[#1e293b] rounded animate-pulse"
              style={{ width: `${w}%` }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !prediction && (
        <div className="flex flex-col items-center justify-center py-10 px-5 text-center gap-3">
          <svg className="w-10 h-10 text-[#334155]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <p className="text-sm text-[#475569]">
            Click <span className="text-white font-medium">Get AI Prediction</span> to analyse{symbol ? ` ${symbol}` : ' this instrument'}
          </p>
        </div>
      )}

      {/* Result */}
      {!loading && prediction && (
        <div className="divide-y divide-[#1e293b]">

          {/* ── Signal header ── */}
          <div className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-black" style={{ color: signalColor }}>
                  {signalLabel}
                </p>
                <p className="text-xs text-[#64748b] mt-0.5">
                  via <span className="text-[#94a3b8] capitalize">{prediction.aiProvider}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-white">{prediction.confidence}<span className="text-base text-[#64748b]">%</span></p>
                <p className="text-[10px] text-[#475569] uppercase tracking-wider">Confidence</p>
              </div>
            </div>
            {/* Main confidence bar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-[#1e293b] rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{ width: `${prediction.confidence}%`, backgroundColor: signalColor }}
                />
              </div>
              <span className="text-xs text-[#64748b]">{prediction.confidence}/100</span>
            </div>
          </div>

          {/* ── Per-provider breakdown ── */}
          {prediction.individual_results_list && prediction.individual_results_list.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">AI Engines</p>
                {prediction.all_agreed !== undefined && (
                  <span className={clsx(
                    'text-[10px] font-bold px-2 py-0.5 rounded-full',
                    prediction.all_agreed
                      ? 'bg-green-900/40 text-green-400 border border-green-800'
                      : 'bg-yellow-900/30 text-yellow-400 border border-yellow-800'
                  )}>
                    {prediction.all_agreed ? 'All Agree' : 'Mixed'}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {prediction.individual_results_list.map((r) => {
                  const abbr = PROVIDER_ABBR[r.provider?.toLowerCase()] ?? r.provider?.slice(0,2).toUpperCase() ?? '??';
                  const col =
                    r.direction === 'BUY'  ? '#00ff88' :
                    r.direction === 'SELL' ? '#ff4444' : '#ffaa00';
                  return (
                    <div key={r.provider} className="flex items-center gap-2 text-xs">
                      <span className="w-5 text-center text-[10px] font-bold text-[#64748b]">{abbr}</span>
                      <span className="text-[#94a3b8] w-[72px] capitalize truncate">{r.provider}</span>
                      <span className="font-bold w-8" style={{ color: col }}>{r.direction}</span>
                      <ConfBar pct={r.confidence} color={col} />
                      <span className="text-[#64748b] w-7 text-right">{r.confidence}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Trade plan ── */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">Trade Plan</p>
            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div className="bg-[#1e293b] rounded-xl p-3 text-center">
                <p className="text-[#64748b] mb-1 text-[10px] uppercase tracking-wider">Entry</p>
                <p className="font-mono font-bold text-blue-400 text-sm">{fmtPrice(prediction.entryPrice)}</p>
              </div>
              <div className="bg-[#1e293b] rounded-xl p-3 text-center">
                <p className="text-[#64748b] mb-1 text-[10px] uppercase tracking-wider">Stop Loss</p>
                <p className="font-mono font-bold text-red-400 text-sm">{fmtPrice(prediction.stopLoss)}</p>
              </div>
            </div>
            {/* Take profits */}
            {(prediction.takeProfit1 ?? prediction.takeProfit) ? (
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: 'TP1', val: prediction.takeProfit1 ?? prediction.takeProfit },
                  { label: 'TP2', val: prediction.takeProfit2 },
                  { label: 'TP3', val: prediction.takeProfit3 },
                ]
                  .filter((tp) => tp.val)
                  .map((tp) => (
                    <div key={tp.label} className="bg-[#052e16]/60 rounded-xl p-2.5 text-center border border-emerald-900/30">
                      <p className="text-[10px] text-[#64748b] mb-1">{tp.label}</p>
                      <p className="font-mono font-bold text-emerald-400">{fmtPrice(tp.val)}</p>
                    </div>
                  ))}
              </div>
            ) : null}
            <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-[#1e293b]">
              <span className="text-[#64748b]">Risk : Reward</span>
              <span className="font-bold text-white">1 : {prediction.riskRewardRatio?.toFixed(2) ?? '—'}</span>
            </div>
          </div>

          {/* ── Market context badges ── */}
          {(prediction.session || prediction.volatility) && (
            <div className="px-5 py-3 flex gap-2 flex-wrap">
              {prediction.session && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-blue-900/30 text-blue-400 border border-blue-900/50">
                  {prediction.session.charAt(0).toUpperCase() + prediction.session.slice(1)} Session
                </span>
              )}
              {prediction.volatility && (
                <span className={clsx(
                  'text-xs px-2.5 py-1 rounded-full border',
                  prediction.volatility === 'high'
                    ? 'bg-red-900/30 text-red-400 border-red-900/50'
                    : prediction.volatility === 'medium'
                    ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50'
                    : 'bg-slate-800 text-slate-300 border-slate-700'
                )}>
                  {prediction.volatility.charAt(0).toUpperCase() + prediction.volatility.slice(1)} Vol
                </span>
              )}
            </div>
          )}

          {/* ── Confirmations ── */}
          {prediction.breakdown && prediction.breakdown.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Signals</p>
              <div className="space-y-1.5">
                {prediction.breakdown.slice(0, 6).map((item, i) => (
                  <p key={i} className={clsx('text-xs leading-relaxed', item.check ? 'text-[#cbd5e1]' : 'text-[#334155]')}>
                    {item.label}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* ── AI explanation ── */}
          {(prediction.why_explanation || prediction.explanation || prediction.reasoning) && (
            <div className="px-5 py-4 space-y-3">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                Why {prediction.direction}{symbol ? ` ${symbol}` : ''}?
              </p>

              {/* Main explanation paragraph */}
              <div className="bg-[#0f172a] rounded-xl p-3 border border-[#334155]">
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {prediction.why_explanation || prediction.explanation || prediction.reasoning}
                </p>
              </div>

              {/* Technical Confirmations */}
              {prediction.technical_confirmations && prediction.technical_confirmations.length > 0 && (
                <div className="bg-[#0f172a] rounded-xl p-3 border border-green-900/40">
                  <p className="text-[10px] font-bold text-green-400 uppercase tracking-wider mb-2">Technical Confirmations</p>
                  <ul className="space-y-1">
                    {prediction.technical_confirmations.map((item, i) => (
                      <li key={i} className="text-xs text-[#cbd5e1] flex items-start gap-1.5">
                        <span className="text-green-400 mt-0.5 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Smart Money Analysis */}
              {prediction.smart_money_analysis && prediction.smart_money_analysis.length > 0 && (
                <div className="bg-[#0f172a] rounded-xl p-3 border border-blue-900/40">
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Smart Money Analysis</p>
                  <ul className="space-y-1">
                    {prediction.smart_money_analysis.map((item, i) => (
                      <li key={i} className="text-xs text-[#cbd5e1] flex items-start gap-1.5">
                        <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {prediction.risks && prediction.risks.length > 0 && (
                <div className="bg-[#0f172a] rounded-xl p-3 border border-red-900/40">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">Risks to Watch</p>
                  <ul className="space-y-1">
                    {prediction.risks.map((item, i) => (
                      <li key={i} className="text-xs text-[#cbd5e1] flex items-start gap-1.5">
                        <span className="text-red-400 mt-0.5 flex-shrink-0">•</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Entry & Exit Strategy */}
              {(prediction.entry_strategy || prediction.exit_strategy) && (
                <div className="bg-[#0f172a] rounded-xl p-3 border border-purple-900/40">
                  <p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-2">Execution Plan</p>
                  {prediction.entry_strategy && (
                    <p className="text-xs text-[#cbd5e1] mb-1.5">
                      <span className="text-green-400 font-semibold">Entry: </span>
                      {prediction.entry_strategy}
                    </p>
                  )}
                  {prediction.exit_strategy && (
                    <p className="text-xs text-[#cbd5e1]">
                      <span className="text-red-400 font-semibold">Management: </span>
                      {prediction.exit_strategy}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
