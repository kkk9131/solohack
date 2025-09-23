"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TopNav() {
  const pathname = usePathname();
  const items = [
    { href: '/', label: 'Home' },
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/studio', label: 'Studio' },
    { href: '/explorer', label: 'Explorer' },
    { href: '/settings', label: 'Settings' },
  ];
  return (
    <nav className="sticky top-0 z-40 bg-hud/80 backdrop-blur border-b border-neon/20">
      <div className="mx-auto max-w-[120rem] px-3 md:px-4 py-2 flex items-center gap-2">
        <div className="text-neon font-pixel">SOLOHACK</div>
        <div className="flex items-center gap-1 md:gap-2 ml-2 overflow-x-auto">
          {items.map((it) => {
            const active = pathname === it.href;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 py-1.5 rounded-md border ${active ? 'border-neon/60 bg-neon/10 text-neon' : 'border-neon/20 text-white/80 hover:bg-neon/5'}`}
              >
                {it.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

