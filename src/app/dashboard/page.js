'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText, Clock, CheckCircle2, AlertCircle, Filter,
  ChevronRight, RefreshCw, TrendingUp, Inbox, Loader2,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn, formatDateTime, getRelativeTime, truncate } from '@/lib/utils';
import { REPORT_STATUS, REPORT_CATEGORY_LABELS } from '@/lib/constants';
import TelegramLinkCard from '@/components/ui/TelegramLinkCard';

const STAT_CARDS = [
  { key: 'dikirim', label: 'Laporan Baru', icon: Inbox, color: 'text-sky-600 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-500/10', ring: 'ring-sky-200' },
  { key: 'dalam_proses', label: 'Sedang Proses', icon: Clock, color: 'text-amber-600 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-500/10', ring: 'ring-amber-200' },
  { key: 'selesai', label: 'Selesai', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-500/10', ring: 'ring-emerald-200' },
  { key: 'ditolak', label: 'Ditolak', icon: AlertCircle, color: 'text-rose-600 dark:text-rose-300', bg: 'bg-rose-50 dark:bg-rose-500/10', ring: 'ring-rose-200' },
  { key: 'total', label: 'Total Laporan', icon: FileText, color: 'text-secondary-foreground', bg: 'bg-background', ring: 'ring-border' },
];

const STATUS_FILTERS = [
  { value: '', label: 'Semua' },
  { value: 'dikirim', label: 'Baru' },
  { value: 'diterima', label: 'Diterima' },
  { value: 'ditugaskan', label: 'Ditugaskan' },
  { value: 'dalam_proses', label: 'Proses' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'ditolak', label: 'Ditolak' },
];

export default function DashboardPage() {
  const router = useRouter();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [stats, setStats] = useState({ dikirim: 0, dalam_proses: 0, selesai: 0, ditolak: 0, total: 0 });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/reports?${params}`);
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      const data = await res.json();
      setReports(data.reports || []);

      // Calculate stats from unfiltered data
      if (!statusFilter) {
        const s = { dikirim: 0, dalam_proses: 0, selesai: 0, ditolak: 0, total: data.total || 0 };
        (data.reports || []).forEach((r) => {
          if (r.status === 'dikirim' || r.status === 'diterima') s.dikirim++;
          if (r.status === 'ditugaskan' || r.status === 'dalam_proses') s.dalam_proses++;
          if (r.status === 'ditolak') s.ditolak++;
          if (r.status === 'selesai') s.selesai++;
        });
        setStats(s);
      }
    } catch {
      // Handle error silently
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Existing dashboard fetch pattern intentionally stays client-side for this UI-only change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  return (
    <div className="min-h-[80vh] bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard Koordinator</h1>
              <p className="text-sm text-muted-foreground mt-1">Kelola laporan masalah sampah kelurahan</p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchReports}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Telegram Integration Card */}
        <div className="mb-8 max-w-2xl">
          <TelegramLinkCard />
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STAT_CARDS.map((stat) => {
            const Icon = stat.icon;
            const value = stats[stat.key] || 0;
            return (
              <Card key={stat.key} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{value}</p>
                  </div>
                  <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', stat.bg)}>
                    <Icon className={cn('w-6 h-6', stat.color)} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Filter + Table */}
        <Card className="overflow-hidden">
          {/* Filter Bar */}
          <div className="p-4 border-b border-border flex items-center gap-2 overflow-x-auto">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  statusFilter === f.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-muted text-secondary-foreground hover:bg-muted'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="ml-2 text-sm text-muted-foreground">Memuat laporan...</span>
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-20">
              <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">Belum ada laporan</p>
              <p className="text-sm text-muted-foreground mt-1">Laporan dari warga akan muncul di sini</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-background text-left">
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kode</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kategori</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Deskripsi</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Waktu</th>
                    <th className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reports.map((report) => (
                    <tr
                      key={report.id}
                      className="hover:bg-background transition-colors cursor-pointer group"
                      onClick={() => router.push(`/dashboard/laporan/${report.id}`)}
                    >
                      <td className="px-5 py-4">
                        <span className="text-sm font-mono font-semibold text-emerald-700 dark:text-emerald-300">{report.tracking_code}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-sm text-secondary-foreground">{REPORT_CATEGORY_LABELS[report.category] || report.category}</span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">{truncate(report.description, 60)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={report.status} size="sm" />
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        <span className="text-xs text-muted-foreground">{getRelativeTime(report.created_at)}</span>
                      </td>
                      <td className="px-5 py-4">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
