'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, FileText, Search, Info, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    
    // Function to fetch role
    const fetchRole = async (userId) => {
      const { data } = await supabase.from('users').select('role').eq('auth_user_id', userId).single();
      if (data) setUserRole(data.role);
    };

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) fetchRole(currentUser.id);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) fetchRole(currentUser.id);
      else setUserRole(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Determine auth redirect path
  const authPath = user ? (userRole === 'petugas' ? '/petugas' : '/dashboard') : '/login';

  // Base nav items
  const navItems = [
    { href: '/', label: 'Beranda', icon: Home },
    { href: '/lapor', label: 'Lapor', icon: FileText },
    { href: '/tracking', label: 'Lacak', icon: Search },
    { href: '/info', label: 'Info', icon: Info },
    { href: authPath, label: 'Akun', icon: User },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-slate-200 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
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
