import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const POLL_MS = 10 * 60 * 1000;
export const CHECK_EVENT = 'sop:check-update';

/**
 * An open tab (or an installed home-screen app) keeps running the code it
 * loaded, so a deploy is invisible until it's reloaded. This polls
 * /version.json — on start, when the app comes back to the foreground, and
 * every 10 minutes — and offers a reload when a newer build is live. It never
 * reloads by itself: that could land mid-sentence.
 */
export function UpdateCheck() {
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState(null);

  const check = useCallback(async (manual = false) => {
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const v = await res.json();
      if (v.buildTime && v.buildTime !== __BUILD_TIME__) {
        setLatest(v);
      } else if (manual) {
        setStatus('You have the latest version.');
      }
    } catch {
      if (manual) setStatus('Could not check for updates — are you offline?');
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => check(), 3000);
    const timer = setInterval(() => check(), POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check();
    const onManual = () => check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    window.addEventListener('online', onVisible);
    window.addEventListener(CHECK_EVENT, onManual);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('online', onVisible);
      window.removeEventListener(CHECK_EVENT, onManual);
    };
  }, [check]);

  useEffect(() => {
    if (!status) return undefined;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  if (latest) {
    return (
      <div className="update-bar" role="status">
        <span>A new version is available{latest.version ? ` (v${latest.version})` : ''}.</span>
        <button className="update-btn" onClick={() => window.location.reload()}><RefreshCw size={14} /> Reload</button>
      </div>
    );
  }
  return status ? <div className="toast" role="status"><span>{status}</span></div> : null;
}
