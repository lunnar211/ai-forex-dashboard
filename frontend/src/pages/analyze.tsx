'use client';
import { useEffect, useState, useRef, ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import clsx from 'clsx';
import { useAuthStore } from '../store/authStore';
import { ai } from '../services/api';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';

interface ImageAnalysis {
  symbol?: string;
  timeframe?: string;
  direction?: 'BUY' | 'SELL' | 'HOLD';
  confidence?: number;
  entryPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  trend?: string;
  patterns?: string[];
  reasoning?: string;
  keyLevels?: string;
  keyRisks?: string;
  marketBias?: string;
  timeHorizon?: string;
  disclaimer?: string;
  aiProvider?: string;
}

export default function Analyze() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<ImageAnalysis | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  function handleFileSelect(file: File) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10 MB.');
      return;
    }
    setError('');
    setAnalysis(null);
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  async function handleAnalyze() {
    if (!selectedFile) return;
    setError('');
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      const data = await ai.analyzeImage(formData);
      setAnalysis(data.analysis);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setSelectedFile(null);
    setPreview(null);
    setAnalysis(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  if (!isAuthenticated) return null;

  const directionColor =
    analysis?.direction === 'BUY'
      ? 'text-green-400'
      : analysis?.direction === 'SELL'
      ? 'text-red-400'
      : 'text-yellow-400';

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6 space-y-5">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Signal Image Analysis</h1>
            <p className="text-sm text-[#64748b]">
              Upload a forex chart or signal screenshot and let AI analyze it for trading signals.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload panel */}
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => !selectedFile && fileInputRef.current?.click()}
                className={clsx(
                  'relative border-2 border-dashed rounded-2xl transition-all cursor-pointer',
                  dragOver
                    ? 'border-blue-400 bg-blue-900/20'
                    : selectedFile
                    ? 'border-[#334155] cursor-default'
                    : 'border-[#334155] hover:border-[#475569] hover:bg-[#1e293b]/50'
                )}
              >
                {preview ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Selected chart"
                      className="w-full rounded-2xl object-contain max-h-80"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReset(); }}
                      className="absolute top-2 right-2 w-8 h-8 bg-[#0f172a]/80 hover:bg-red-900/80 text-[#94a3b8] hover:text-red-400 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-[#1e293b] border border-[#334155] flex items-center justify-center mb-4">
                      <svg className="w-7 h-7 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-white font-medium text-sm mb-1">Drop your chart image here</p>
                    <p className="text-[#475569] text-xs">or click to browse · JPEG, PNG, WebP · max 10 MB</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleInputChange}
                className="hidden"
              />

              {selectedFile && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1e293b] border border-[#334155] rounded-xl">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="text-xs text-[#94a3b8] truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-[#475569]">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-[#7f1d1d] border border-[#ef4444] rounded-lg text-sm text-[#fca5a5]">
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || loading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all shadow-lg text-sm"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Analysing Image…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Analyse with AI
                  </>
                )}
              </button>
            </div>

            {/* Analysis result */}
            <div>
              {!analysis && !loading && (
                <div className="h-full flex flex-col items-center justify-center py-16 text-[#334155] text-center">
                  <svg className="w-16 h-16 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <p className="text-sm">Upload an image and click &quot;Analyse with AI&quot; to get started.</p>
                </div>
              )}

              {loading && (
                <div className="h-full flex flex-col items-center justify-center py-16 text-[#475569]">
                  <svg className="animate-spin w-10 h-10 mb-4 text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <p className="text-sm">AI is analysing your chart…</p>
                  <p className="text-xs mt-1 text-[#334155]">This may take a few seconds.</p>
                </div>
              )}

              {analysis && !loading && (
                <div className="space-y-4">
                  {/* Direction badge */}
                  <div className="flex items-center gap-3 p-4 bg-[#1e293b] border border-[#334155] rounded-2xl">
                    <div className={clsx(
                      'w-16 h-16 rounded-xl flex flex-col items-center justify-center flex-shrink-0',
                      analysis.direction === 'BUY' ? 'bg-green-900/40 border border-green-500/30' :
                      analysis.direction === 'SELL' ? 'bg-red-900/40 border border-red-500/30' :
                      'bg-yellow-900/40 border border-yellow-500/30'
                    )}>
                      <span className={clsx('text-lg font-bold', directionColor)}>{analysis.direction}</span>
                      {analysis.confidence != null && (
                        <span className="text-xs text-[#64748b] mt-0.5">{analysis.confidence}%</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-2 mb-1">
                        {analysis.symbol && (
                          <span className="px-2 py-0.5 bg-[#0f172a] border border-[#334155] rounded text-xs text-white font-mono">
                            {analysis.symbol}
                          </span>
                        )}
                        {analysis.timeframe && (
                          <span className="px-2 py-0.5 bg-[#0f172a] border border-[#334155] rounded text-xs text-[#94a3b8]">
                            {analysis.timeframe}
                          </span>
                        )}
                        {analysis.trend && (
                          <span className="px-2 py-0.5 bg-[#0f172a] border border-[#334155] rounded text-xs text-[#94a3b8]">
                            {analysis.trend}
                          </span>
                        )}
                      </div>
                      {analysis.marketBias && (
                        <p className="text-xs text-[#64748b]">Market Bias: <span className="text-[#94a3b8]">{analysis.marketBias}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Price levels */}
                  {(analysis.entryPrice || analysis.stopLoss || analysis.takeProfit) && (
                    <div className="grid grid-cols-3 gap-2">
                      {analysis.entryPrice != null && (
                        <PriceCard label="Entry" value={analysis.entryPrice} color="blue" />
                      )}
                      {analysis.stopLoss != null && (
                        <PriceCard label="Stop Loss" value={analysis.stopLoss} color="red" />
                      )}
                      {analysis.takeProfit != null && (
                        <PriceCard label="Take Profit" value={analysis.takeProfit} color="green" />
                      )}
                    </div>
                  )}

                  {/* Patterns */}
                  {analysis.patterns && analysis.patterns.length > 0 && (
                    <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-xl">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Patterns Detected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.patterns.map((p, i) => (
                          <span key={i} className="px-2 py-0.5 bg-purple-900/30 border border-purple-500/20 text-purple-300 text-xs rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Reasoning */}
                  {analysis.reasoning && (
                    <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-xl">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Analysis</p>
                      <p className="text-sm text-[#94a3b8] leading-relaxed">{analysis.reasoning}</p>
                    </div>
                  )}

                  {/* Key levels */}
                  {analysis.keyLevels && (
                    <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-xl">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Key Levels</p>
                      <p className="text-sm text-[#94a3b8]">{analysis.keyLevels}</p>
                    </div>
                  )}

                  {/* Risks */}
                  {analysis.keyRisks && (
                    <div className="p-4 bg-[#1e293b] border border-[#334155] rounded-xl">
                      <p className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-2">Key Risks</p>
                      <p className="text-sm text-[#94a3b8]">{analysis.keyRisks}</p>
                    </div>
                  )}

                  {analysis.disclaimer && (
                    <p className="text-xs text-[#334155] text-center">⚠️ {analysis.disclaimer}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function PriceCard({ label, value, color }: { label: string; value: number; color: 'blue' | 'red' | 'green' }) {
  const colors = {
    blue: 'text-blue-400 border-blue-500/20 bg-blue-900/20',
    red: 'text-red-400 border-red-500/20 bg-red-900/20',
    green: 'text-green-400 border-green-500/20 bg-green-900/20',
  };
  return (
    <div className={`p-3 rounded-xl border text-center ${colors[color]}`}>
      <p className="text-xs opacity-70 mb-1">{label}</p>
      <p className="text-sm font-mono font-bold">{typeof value === 'number' ? value.toFixed(5) : value}</p>
    </div>
  );
}
