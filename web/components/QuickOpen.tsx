"use client";
import { useEffect, useMemo, useRef, useState } from 'react';

export default function QuickOpen({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (rel: string) => void }) {
  const [q, setQ] = useState('');
  const [list, setList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setList([]);
      setLoading(true);
      fetch('/api/fs/find?limit=200')
        .then((r) => r.json())
        .then((d) => setList(d.files as string[]))
        .catch(() => setList([]))
        .finally(() => setLoading(false));
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const filtered = useMemo(() => {
    if (!q.trim()) return list;
    const s = q.trim().toLowerCase();
    return list.filter((f) => f.toLowerCase().includes(s));
  }, [q, list]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute left-1/2 top-24 -translate-x-1/2 w-[92vw] max-w-2xl bg-hud/95 border border-neon/30 rounded-md shadow-glow">
        <div className="p-2 border-b border-neon/20">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Quick Open (type to filter, Enter to open)"
            className="w-full bg-bg text-white/90 placeholder:text-white/40 border border-neon/20 rounded-md px-3 py-2 focus:outline-none focus:border-neon/40"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); onClose(); }
              else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(filtered.length - 1, i + 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (filtered[idx]) { onPick(filtered[idx]); onClose(); } }
            }}
          />
        </div>
        <div className="max-h-[50vh] overflow-auto">
          {loading ? (
            <div className="p-3 text-sm text-white/60">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-sm text-white/60">No matches</div>
          ) : (
            <ul>
              {filtered.slice(0, 200).map((f, i) => (
                <li key={f} className={`px-3 py-2 text-sm cursor-pointer ${i === idx ? 'bg-neon/10' : ''}`} onMouseEnter={() => setIdx(i)} onMouseDown={(e) => { e.preventDefault(); onPick(f); onClose(); }}>
                  <span className="text-neon/80">{f}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

