'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Leaf, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NAV_ITEMS, APP_CONFIG } from '@/lib/constants';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/theme/ThemeToggle';
import { createClient } from '@/lib/supabase/client';

export default function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const pathname = usePathname();
  const router = useRouter();

  const navItems = NAV_ITEMS.public;

  useEffect(() => {
    const supabase = createClient();
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 glass border-b border-border backdrop-blur-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-gradient-emerald rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              {APP_CONFIG.name}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200',
                  pathname === item.href
                    ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'text-secondary-foreground hover:text-foreground hover:bg-muted'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3 font-bold">
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" icon={LayoutDashboard}>Dashboard</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout} icon={LogOut}>Keluar</Button>
              </>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">Masuk</Button>
              </Link>
            )}
            <Link href="/lapor">
              <Button size="sm">Laporkan Sekarang</Button>
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-secondary-foreground hover:bg-muted transition"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-border mt-2 animate-fade-in">
            <div className="flex flex-col gap-1 pt-3">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    'px-4 py-2.5 rounded-lg text-sm font-bold transition-colors',
                    pathname === item.href
                      ? 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10'
                      : 'text-secondary-foreground hover:bg-muted'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-border font-bold">
                <ThemeToggle showLabel className="w-full" />
                {user ? (
                  <>
                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <Button variant="secondary" size="sm" className="w-full" icon={LayoutDashboard}>Dashboard</Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="w-full" onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }} icon={LogOut}>Keluar</Button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="secondary" size="sm" className="w-full">Masuk</Button>
                  </Link>
                )}
                <Link href="/lapor" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button size="sm" className="w-full">Laporkan Sekarang</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
