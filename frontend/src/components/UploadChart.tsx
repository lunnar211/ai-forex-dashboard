'use client';
import { useState, useRef, useCallback } from 'react';
import clsx from 'clsx';
import { upload } from '../services/api';
import type { ChartAnalysis, ForexSymbol } from '../types';

const SYMBOLS: ForexSymbol[] = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'XAU/USD'];

interface Props {
  onAnalysis?: (result: ChartAnalysis) => void;
}

const directionStyles = {
  BUY: 'bg-[#166534] text-[#22c55e] border-[#22c55e]',
  SELL: 'bg-[#7f1d1d] text-[#ef4444] border-[#ef4444]',
  HOLD: 'bg-[#713f12] text-[#eab308] border-[#eab308]',
};

export default function UploadChart({ onAnalysis }: Props) {
  const [symbol, setSymbol] = useState<ForexSymbol>('EUR/USD');
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ChartAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Only image files are supported (JPEG, PNG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be under 5 MB.');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    setError('');
    setResult(null);
    try {
      const analysis: ChartAnalysis = await upload.analyzeChart(file, symbol);
      setResult(analysis);
      onAnalysis?.(analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [symbol, onAnalysis]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const direction = (result?.direction?.toUpperCase() ?? 'HOLD') as keyof typeof directionStyles;
  const dirStyle = directionStyles[direction] ?? directionStyles.HOLD;

  return (
    <div className="space-y-5">
      {/* Symbol selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-[#94a3b8] uppercase tracking-wider">Symbol:</span>
        {SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border',
              symbol === s
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:text-white'
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={clsx(
          'relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-[#334155] bg-[#1e293b] hover:border-[#475569]'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Chart preview"
            className="max-h-48 mx-auto rounded-lg object-contain"
          />
        ) : (
          <>
            <svg className="w-12 h-12 mx-auto mb-3 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-[#94a3b8] mb-1">Drop your chart screenshot here</p>
            <p className="text-xs text-[#475569]">or click to select · JPEG, PNG, WebP · max 5 MB</p>
          </>
        )}
        {loading && (
          <div className="absolute inset-0 bg-[#0f172a]/70 rounded-xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-white">
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Analysing chart…
            </div>
          </div>
        )}
      </div>

      {preview && !loading && (
        <button
          onClick={() => { setPreview(null); setResult(null); setError(''); }}
          className="text-xs text-[#475569] hover:text-[#94a3b8] transition-colors"
        >
          ✕ Clear & upload another
        </button>
      )}

      {error && (
        <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
          {error}
        </div>
      )}

      {/* Analysis result */}
      {result && (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#334155]">
            <div>
              <p className="text-xs text-[#94a3b8] uppercase tracking-wider mb-1">
                Chart Analysis — {result.symbol}
                {result.isMockAnalysis && (
                  <span className="ml-2 text-[#eab308]">(Demo — add API key for AI analysis)</span>
                )}
              </p>
              <span className={clsx('text-xl font-black px-3 py-1 rounded-lg border-2', dirStyle)}>
                {direction}
              </span>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#94a3b8] mb-1">Confidence</p>
              <p className="text-3xl font-black text-white">{result.confidence}%</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Trend + Patterns */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0f172a] rounded-lg p-3 text-center">
                <p className="text-xs text-[#94a3b8] mb-1">Trend</p>
                <p className={clsx('font-bold text-sm',
                  result.trend === 'BULLISH' ? 'text-[#22c55e]' :
                  result.trend === 'BEARISH' ? 'text-[#ef4444]' : 'text-[#eab308]'
                )}>
                  {result.trend}
                </p>
              </div>
              <div className="bg-[#0f172a] rounded-lg p-3">
                <p className="text-xs text-[#94a3b8] mb-1">Patterns Detected</p>
                {result.patterns.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {result.patterns.map((p, i) => (
                      <span key={i} className="text-xs bg-[#1e293b] px-1.5 py-0.5 rounded text-blue-300">
                        {p}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#475569]">None detected</p>
                )}
              </div>
            </div>

            {/* Buy / Sell Reasons */}
            {(result.buyReasons.length > 0 || result.sellReasons.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.buyReasons.length > 0 && (
                  <div className="bg-[#0f172a] rounded-lg p-3 border-l-2 border-[#22c55e]">
                    <p className="text-xs font-semibold text-[#22c55e] uppercase mb-2">Why BUY</p>
                    <ul className="space-y-1">
                      {result.buyReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-[#cbd5e1]">
                          <span className="text-[#22c55e] mt-0.5">✓</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.sellReasons.length > 0 && (
                  <div className="bg-[#0f172a] rounded-lg p-3 border-l-2 border-[#ef4444]">
                    <p className="text-xs font-semibold text-[#ef4444] uppercase mb-2">Why SELL</p>
                    <ul className="space-y-1">
                      {result.sellReasons.map((r, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-[#cbd5e1]">
                          <span className="text-[#ef4444] mt-0.5">✗</span>{r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Support/Resistance */}
            {(result.supportLevels.length > 0 || result.resistanceLevels.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0f172a] rounded-lg p-3">
                  <p className="text-xs text-[#94a3b8] mb-1.5">Support</p>
                  {result.supportLevels.map((l, i) => (
                    <p key={i} className="text-xs font-mono text-[#22c55e]">{l}</p>
                  ))}
                </div>
                <div className="bg-[#0f172a] rounded-lg p-3">
                  <p className="text-xs text-[#94a3b8] mb-1.5">Resistance</p>
                  {result.resistanceLevels.map((l, i) => (
                    <p key={i} className="text-xs font-mono text-[#ef4444]">{l}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Next Signal */}
            {result.nextSignalEta && (
              <div className="bg-[#0f172a] rounded-lg p-3 flex items-start gap-2">
                <span className="text-lg">⏱</span>
                <div>
                  <p className="text-xs font-semibold text-[#94a3b8] uppercase mb-0.5">Next Signal</p>
                  <p className="text-xs text-[#cbd5e1]">{result.nextSignalEta}</p>
                </div>
              </div>
            )}

            {/* Analysis */}
            <div className="bg-[#0f172a] rounded-lg p-3">
              <p className="text-xs font-semibold text-[#94a3b8] uppercase mb-2">Analysis</p>
              <p className="text-xs text-[#cbd5e1] leading-relaxed">{result.analysis}</p>
            </div>

            <p className="text-xs text-[#475569] text-center">{result.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
