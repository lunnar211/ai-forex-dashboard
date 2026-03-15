import type { AppProps } from 'next/app';
import '../styles/globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { activity } from '../services/api';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  useEffect(() => {
    function handleRouteChange(url: string) {
      // Extract page name from URL path
      const page = url.split('?')[0].replace(/^\//, '') || 'home';
      // Only track authenticated page views (silently ignores if not logged in)
      activity.track({ action: 'page_view', page });
    }

    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return <Component {...pageProps} />;
}
