'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { forex } from '../services/api';

const LIVE_SYMBOLS = ['EUR/USD', 'GBP/USD', 'USD/JPY'];

interface LivePrice {
  symbol: string;
  price: number;
  prev: number | null;
}

export default function TopNav() {
  const { user, logout } = useAuthStore();
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});

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
    const id = setInterval(fetchPrices, 30_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0f172a] border-b border-[#334155]">
      <div className="flex items-center gap-6">
        {LIVE_SYMBOLS.map((sym) => {
          const p = prices[sym];
          if (!p) return (
            <div key={sym} className="hidden sm:flex items-center gap-1 text-xs text-[#475569]">
              <span>{sym}</span>
              <span className="animate-pulse">—</span>
            </div>
          );
          const up = p.prev !== null ? p.price >= p.prev : null;
          return (
            <div key={sym} className="hidden sm:flex items-center gap-1.5 text-sm">
              <span className="text-[#94a3b8] font-medium">{sym}</span>
              <span className="font-mono font-semibold text-white">
                {p.price.toFixed(sym === 'USD/JPY' ? 3 : 5)}
              </span>
              {up !== null && (
                <span className={up ? 'text-[#22c55e] text-xs' : 'text-[#ef4444] text-xs'}>
                  {up ? '▲' : '▼'}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <span className="hidden sm:block text-sm text-[#94a3b8] truncate max-w-[180px]">
            {user.email}
          </span>
        )}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-[#1e293b] text-[#94a3b8] hover:text-white hover:bg-[#334155] transition-colors border border-[#334155]"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
