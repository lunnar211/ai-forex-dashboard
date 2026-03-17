'use client';
import { useEffect, useState } from 'react';
import { auth } from '../services/api';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setVisible(true);
    }
  }, []);

  async function handleAccept(accepted: boolean) {
    localStorage.setItem('cookie-consent', accepted ? 'all' : 'necessary');
    setVisible(false);
    try {
      await auth.cookieConsent(accepted);
    } catch {
      // Non-critical: ignore errors when saving to DB
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-[#334155] px-4 py-4 md:px-8">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1">
          <p className="text-sm text-[#94a3b8]">
            <span className="text-white font-semibold">🍪 Cookie Notice: </span>
            We use cookies to improve your experience, analyse site usage, and remember your preferences.
            By clicking &quot;Accept All&quot; you consent to our use of all cookies.
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <button
            onClick={() => handleAccept(false)}
            className="px-4 py-2 text-sm text-[#94a3b8] border border-[#334155] rounded-lg hover:border-[#475569] hover:text-white transition-colors"
          >
            Necessary Only
          </button>
          <button
            onClick={() => handleAccept(true)}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
