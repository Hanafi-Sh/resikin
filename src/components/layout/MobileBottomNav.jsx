'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Search, Info, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const MOBILE_NAV_ITEMS = [
  { href: '/', label: 'Beranda', icon: Home },
  { href: '/lapor', label: 'Lapor', icon: FileText },
  { href: '/tracking', label: 'Lacak', icon: Search },
  { href: '/info', label: 'Info', icon: Info },
  { href: '/login', label: 'Akun', icon: User },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Don't show on dashboard/petugas pages (they have their own nav)
  const hiddenPaths = ['/dashboard', '/petugas'];
  if (hiddenPaths.some(p => pathname.startsWith(p))) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || 
            (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-2 px-3 rounded-xl transition-all min-w-[56px]',
                isActive
                  ? 'text-emerald-600'
                  : 'text-slate-400 active:text-slate-600'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'stroke-[2.5]')} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive ? 'text-emerald-600' : 'text-slate-400'
              )}>
                {item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 w-5 h-0.5 bg-emerald-500 rounded-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
