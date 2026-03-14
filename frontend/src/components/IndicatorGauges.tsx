'use client';
import clsx from 'clsx';

interface MacdData {
  macd: number;
  signal: number;
  histogram: number;
}

interface Props {
  rsi: number | null;
  macd: MacdData | null;
}

function RSIGauge({ value }: { value: number }) {
  const radius = 36;
  const circumference = Math.PI * radius;
  const pct = Math.min(100, Math.max(0, value)) / 100;
  const dash = pct * circumference;
  const color = value < 30 ? '#22c55e' : value > 70 ? '#ef4444' : '#eab308';
  const label = value < 30 ? 'Oversold' : value > 70 ? 'Overbought' : 'Neutral';

  return (
    <div className="bg-[#0f172a] rounded-xl p-4 flex flex-col items-center gap-2">
      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">RSI</p>
      <div className="relative">
        <svg width="100" height="60" viewBox="0 0 100 60">
          {/* Background arc */}
          <path
            d="M 8 54 A 42 42 0 0 1 92 54"
            fill="none"
            stroke="#1e293b"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          <path
            d="M 8 54 A 42 42 0 0 1 92 54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-end justify-center pb-1">
          <span className="text-xl font-black text-white">{value.toFixed(1)}</span>
        </div>
      </div>
      <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded', {
        'text-[#22c55e] bg-[#166534]': value < 30,
        'text-[#ef4444] bg-[#7f1d1d]': value > 70,
        'text-[#eab308] bg-[#713f12]': value >= 30 && value <= 70,
      })}>
        {label}
      </span>
      <div className="flex justify-between w-full text-[10px] text-[#475569] px-1">
        <span>0</span>
        <span>30</span>
        <span>70</span>
        <span>100</span>
      </div>
    </div>
  );
}

function MACDDisplay({ data }: { data: MacdData }) {
  const maxAbs = Math.max(Math.abs(data.macd), Math.abs(data.signal), Math.abs(data.histogram), 0.0001);
  const histW = Math.min(100, (Math.abs(data.histogram) / maxAbs) * 100);
  const histPos = data.histogram >= 0;

  return (
    <div className="bg-[#0f172a] rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">MACD</p>
      <div className="space-y-2">
        {[
          { label: 'MACD', value: data.macd, color: 'text-blue-400' },
          { label: 'Signal', value: data.signal, color: 'text-[#eab308]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex justify-between items-center">
            <span className="text-xs text-[#94a3b8]">{label}</span>
            <span className={clsx('text-xs font-mono font-bold', color)}>
              {value.toFixed(5)}
            </span>
          </div>
        ))}

        {/* Histogram bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-[#94a3b8]">Histogram</span>
            <span className={clsx('text-xs font-mono font-bold', histPos ? 'text-[#22c55e]' : 'text-[#ef4444]')}>
              {data.histogram >= 0 ? '+' : ''}{data.histogram.toFixed(5)}
            </span>
          </div>
          <div className="w-full bg-[#1e293b] rounded-full h-2">
            <div
              className={clsx('h-2 rounded-full transition-all duration-500', histPos ? 'bg-[#22c55e]' : 'bg-[#ef4444]')}
              style={{ width: `${histW}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IndicatorGauges({ rsi, macd }: Props) {
  if (rsi === null && macd === null) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {rsi !== null && <RSIGauge value={rsi} />}
      {macd !== null && <MACDDisplay data={macd} />}
    </div>
  );
}
