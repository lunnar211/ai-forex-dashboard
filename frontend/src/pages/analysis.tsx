'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '../store/authStore';
import Sidebar from '../components/Sidebar';
import TopNav from '../components/TopNav';
import UploadChart from '../components/UploadChart';

export default function Analysis() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.replace('/login');
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex min-h-screen bg-[#0f172a]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav />
        <main className="flex-1 p-4 md:p-6">
          <div className="max-w-3xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-white mb-1">Chart Analysis</h1>
              <p className="text-sm text-[#94a3b8]">
                Upload a screenshot of any forex chart to get AI-powered pattern recognition and
                buy/sell recommendations.
              </p>
            </div>

            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5 md:p-6">
              <UploadChart />
            </div>

            <div className="mt-4 px-4 py-3 bg-[#1e293b] border border-[#334155] rounded-lg text-xs text-[#475569]">
              <strong className="text-[#94a3b8]">Tips:</strong> For best results, use a clean chart
              screenshot with visible candlesticks, price levels, and indicator overlays. JPEG or PNG
              format recommended. Maximum 5 MB.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
