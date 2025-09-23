import type { Metadata } from 'next';
import './globals.css';
import { Press_Start_2P, DotGothic16 } from 'next/font/google';
import ThemeInit from '@/components/ThemeInit';
import TopNav from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'SoloHack Web',
  description: 'Dreamflow風UIで開発をゲーム体験に',
};

const pixel = Press_Start_2P({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-pixel' });
const dot = DotGothic16({ subsets: ['latin'], weight: '400', display: 'swap', variable: '--font-dot' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // 日本語メモ: ダークテーマ前提。Tailwindのクラスで全体トーンを統一。
  return (
    <html lang="ja" className={`dark ${pixel.variable} ${dot.variable}`}>
      <body className="min-h-dvh bg-bg text-white">
        <ThemeInit />
        <TopNav />
        {children}
      </body>
    </html>
  );
}
