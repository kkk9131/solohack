import type { Metadata } from 'next';
import './globals.css';
import { Press_Start_2P } from 'next/font/google';

export const metadata: Metadata = {
  title: 'SoloHack Web',
  description: 'Dreamflow風UIで開発をゲーム体験に',
};

const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-pixel' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 日本語メモ: ダークテーマ前提。Tailwindのクラスで全体トーンを統一。
  return (
    <html lang="ja" className={`dark ${pixel.variable}`}>
      <body className="min-h-dvh bg-bg text-white">{children}</body>
    </html>
  );
}
