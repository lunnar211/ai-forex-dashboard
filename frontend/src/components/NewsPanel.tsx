'use client';
import clsx from 'clsx';
import type { NewsArticle } from '../types';

interface Props {
  articles: NewsArticle[];
  loading: boolean;
  symbol: string;
}

function timeAgo(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SENTIMENT_STYLES: Record<string, { badge: string; dot: string }> = {
  BULLISH:  { badge: 'bg-emerald-900/40 text-emerald-400 border border-emerald-700/50', dot: 'bg-emerald-400' },
  BEARISH:  { badge: 'bg-red-900/40 text-red-400 border border-red-700/50',             dot: 'bg-red-400' },
  NEUTRAL:  { badge: 'bg-slate-700/60 text-slate-400 border border-slate-600/50',       dot: 'bg-slate-400' },
};

export default function NewsPanel({ articles, loading, symbol }: Props) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#334155] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📰</span>
          <span className="text-sm font-semibold text-white">Related News</span>
          <span className="text-xs text-[#475569]">— {symbol}</span>
        </div>
        {loading && (
          <div className="flex items-center gap-1.5 text-xs text-[#475569]">
            <div className="w-3 h-3 border border-[#475569] border-t-blue-400 rounded-full animate-spin" />
            Loading…
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#0f172a] rounded-xl p-4 space-y-2 animate-pulse">
                <div className="h-4 bg-[#334155] rounded w-3/4" />
                <div className="h-3 bg-[#334155] rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* No data */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-6 text-sm text-[#475569]">
            No recent news found for {symbol}. News data requires a NEWSDATA_API_KEY.
          </div>
        )}

        {/* Articles */}
        {!loading && articles.length > 0 && (
          <div className="space-y-3">
            {articles.map((article, idx) => {
              const sStyle = SENTIMENT_STYLES[article.sentiment || 'NEUTRAL'];
              return (
                <div
                  key={idx}
                  className="bg-[#0f172a] rounded-xl p-4 border border-[#1e293b] hover:border-[#334155] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
                        {article.url ? (
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors"
                          >
                            {article.title}
                          </a>
                        ) : (
                          article.title
                        )}
                      </p>
                      {article.description && (
                        <p className="text-xs text-[#64748b] mt-1 line-clamp-2 leading-relaxed">
                          {article.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {article.source && (
                          <span className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wide">
                            {article.source}
                          </span>
                        )}
                        {article.published && (
                          <span className="text-[10px] text-[#475569]">{timeAgo(article.published)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', sStyle.badge)}>
                        <span className={clsx('w-1.5 h-1.5 rounded-full', sStyle.dot)} />
                        {article.sentiment || 'NEUTRAL'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
