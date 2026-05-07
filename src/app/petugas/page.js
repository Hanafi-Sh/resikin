'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin, Clock, ChevronRight, Loader2, ClipboardList,
  ExternalLink, RefreshCw, Inbox,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn, formatDateTime, getRelativeTime } from '@/lib/utils';
import { REPORT_CATEGORY_LABELS } from '@/lib/constants';
import TelegramLinkCard from '@/components/ui/TelegramLinkCard';
import { fetchWithAuthRetry } from '@/lib/auth-fetch';

export default function PetugasPage() {
  const router = useRouter();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuthRetry('/api/assignments');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Existing assignment fetch pattern intentionally stays client-side for this UI-only change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate active vs completed
  const activeTasks = assignments.filter(a => a.report && ['ditugaskan', 'dalam_proses'].includes(a.report.status));
  const completedTasks = assignments.filter(a => a.report && a.report.status === 'selesai');

  return (
    <div className="min-h-[80vh] bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Tugas Saya</h1>
              <p className="text-sm text-muted-foreground mt-1">Daftar tugas penanganan laporan</p>
            </div>
            <Button variant="secondary" size="sm" onClick={fetchAssignments}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        {/* Telegram Integration Card */}
        <div className="mb-8">
          <TelegramLinkCard />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-sm text-muted-foreground">Memuat tugas...</span>
          </div>
        ) : assignments.length === 0 ? (
          <Card className="p-10 text-center">
            <Inbox className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Belum ada tugas</p>
            <p className="text-sm text-muted-foreground mt-1">Tugas dari koordinator akan muncul di sini</p>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Active Tasks */}
            {activeTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Tugas Aktif ({activeTasks.length})
                </h2>
                <div className="space-y-3">
                  {activeTasks.map((assignment) => (
                    <Card
                      key={assignment.id}
                      hover
                      className="p-5 cursor-pointer group"
                      onClick={() => router.push(`/petugas/tugas/${assignment.id}`)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-emerald-600">{assignment.report.tracking_code}</span>
                            <StatusBadge status={assignment.report.status} size="sm" />
                          </div>
                          <h3 className="text-sm font-bold text-foreground">
                            {REPORT_CATEGORY_LABELS[assignment.report.category]}
                          </h3>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{assignment.report.description}</p>

                          <div className="flex items-center gap-4 mt-3">
                            {assignment.report.address && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {assignment.report.address.substring(0, 40)}...
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {getRelativeTime(assignment.assigned_at)}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition shrink-0 ml-3" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
                  ✅ Selesai ({completedTasks.length})
                </h2>
                <div className="space-y-3 opacity-70">
                  {completedTasks.map((assignment) => (
                    <Card
                      key={assignment.id}
                      className="p-4 cursor-pointer"
                      onClick={() => router.push(`/petugas/tugas/${assignment.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">{assignment.report.tracking_code}</span>
                            <StatusBadge status="selesai" size="sm" />
                          </div>
                          <p className="text-sm text-secondary-foreground mt-1">
                            {REPORT_CATEGORY_LABELS[assignment.report.category]}
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
