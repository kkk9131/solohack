"use client";
import { useEffect } from 'react';
import { applyTheme, getSettings } from '@/lib/settings';

// 日本語メモ: 初期ロード時に localStorage のテーマを反映。
export default function ThemeInit() {
  useEffect(() => {
    try {
      const s = getSettings();
      applyTheme(s.theme);
    } catch {}
  }, []);
  return null;
}

