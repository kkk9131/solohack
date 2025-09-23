"use client";
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <html lang="ja">
      <body className="min-h-dvh bg-bg text-white p-6">
        <div className="max-w-3xl mx-auto hud-card p-4 space-y-3">
          <h2 className="text-neon text-xl">Something went wrong</h2>
          <pre className="text-xs whitespace-pre-wrap break-words bg-bg/60 p-3 rounded-md border border-neon/20 overflow-auto max-h-[50vh]">
            {String(error?.stack || error?.message || 'unknown error')}
          </pre>
          <div className="flex items-center gap-2">
            <button onClick={() => reset()} className="px-3 py-2 border border-neon/40 rounded-md text-neon hover:bg-neon/10">
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

