'use client';

import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle({ className, showLabel = false }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Gunakan mode terang' : 'Gunakan mode gelap';
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card text-secondary-foreground shadow-sm',
        'h-10 px-3 text-sm font-semibold transition-all duration-200',
        'hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background',
        className
      )}
      aria-label={label}
      title={label}
      suppressHydrationWarning
    >
      <Icon className="h-4 w-4" />
      {showLabel && <span>{isDark ? 'Terang' : 'Gelap'}</span>}
    </button>
  );
}
