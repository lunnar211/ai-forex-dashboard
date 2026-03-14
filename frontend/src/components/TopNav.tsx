'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { forex } from '../services/api';

const LIVE_SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD'];

interface LivePrice {
  symbol: string;
  price: number;
  prev: number | null;
}

export default function TopNav() {
  const { user } = useAuthStore();
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [currentTime, setCurrentTime] = useState('');

  const fetchPrices = useCallback(async () => {
    const results = await Promise.allSettled(
      LIVE_SYMBOLS.map((s) => forex.getLivePrice(s))
    );
    setPrices((prev) => {
      const next = { ...prev };
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') {
          const sym = LIVE_SYMBOLS[i];
          next[sym] = {
            symbol: sym,
            price: r.value.price,
            prev: prev[sym]?.price ?? null,
          };
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    fetchPrices();
    const priceId = setInterval(fetchPrices, 30_000);
    return () => clearInterval(priceId);
  }, [fetchPrices]);

  useEffect(() => {
    function tick() {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const decimals: Record<string, number> = {
    'USD/JPY': 3,
    'XAU/USD': 2,
  };

  return (
    <header className="flex items-center justify-between px-4 md:px-6 py-3 bg-[#0f172a] border-b border-[#334155]">
      {/* Live prices ticker */}
      <div className="flex items-center gap-4 md:gap-6 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-semibold text-green-400 uppercase tracking-wider">Live</span>
        </div>
        {LIVE_SYMBOLS.map((sym) => {
          const p = prices[sym];
          const dec = decimals[sym] ?? 5;
          if (!p) return (
            <div key={sym} className="hidden sm:flex items-center gap-1.5 text-xs text-[#475569] flex-shrink-0">
              <span className="font-medium">{sym}</span>
              <span className="animate-pulse font-mono">—</span>
            </div>
          );
          const up = p.prev !== null ? p.price >= p.prev : null;
          return (
            <div key={sym} className="hidden sm:flex items-center gap-1.5 text-sm flex-shrink-0">
              <span className="text-[#64748b] text-xs font-medium">{sym}</span>
              <span className="font-mono font-semibold text-white text-xs">
                {p.price.toFixed(dec)}
              </span>
              {up !== null && (
                <span className={up ? 'text-[#22c55e] text-[10px]' : 'text-[#ef4444] text-[10px]'}>
                  {up ? '▲' : '▼'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Right side: time + user */}
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        {currentTime && (
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-[#1e293b] border border-[#334155] rounded-lg">
            <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono text-xs text-[#94a3b8]">{currentTime}</span>
            <span className="text-[10px] text-[#475569]">UTC</span>
          </div>
        )}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1e293b] border border-[#334155] rounded-lg">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
              <span className="text-[9px] font-bold text-white">
                {(user.name || user.email).slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="hidden sm:block text-xs text-[#94a3b8] truncate max-w-[140px]">
              {user.name || user.email}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
