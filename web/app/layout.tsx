import type { Metadata } from 'next';
import './globals.css';
import ThemeInit from '@/components/ThemeInit';

export const metadata: Metadata = {
  title: 'SoloHack Web',
  description: 'Dreamflow風UIで開発をゲーム体験に',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 日本語メモ: ダークテーマ前提。Tailwindのクラスで全体トーンを統一。
  return (
    <html lang="ja" className="dark">
      <body className="min-h-dvh bg-bg text-white">
        <ThemeInit />
        {children}
      </body>
    </html>
  );
}
