'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, UserPlus, MapPin, Clock,
  Phone, User, Loader2, ExternalLink,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ReportPhotoGallery from '@/components/ui/ReportPhotoGallery';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn, formatDateTime } from '@/lib/utils';
import { REPORT_STATUS_LABELS, REPORT_CATEGORY_LABELS, REPORT_STATUS } from '@/lib/constants';

export default function LaporanDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [petugasList, setPetugasList] = useState([]);
  const [selectedPetugas, setSelectedPetugas] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);

  // AI Recommendation State
  const [aiRecommending, setAiRecommending] = useState(false);
  const [aiReason, setAiReason] = useState('');

  useEffect(() => {
    // Existing report fetch pattern intentionally stays client-side for this UI-only change.
    // eslint-disable-next-line react-hooks/immutability
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (report?.kelurahan_id) {
      // Existing petugas fetch pattern intentionally stays client-side for this UI-only change.
      // eslint-disable-next-line react-hooks/immutability
      fetchPetugas(report.kelurahan_id);
    }
  }, [report?.kelurahan_id]);

  const fetchReport = async () => {
    try {
      const res = await fetch(`/api/reports/${id}`);
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      setReport(data.report);
    } catch {} finally {
      setLoading(false);
    }
  };

  const fetchPetugas = async (kelurahanId) => {
    try {
      const res = await fetch(`/api/users/petugas?kelurahan_id=${kelurahanId}`);
      const data = await res.json();
      setPetugasList(data.petugas || []);
    } catch {}
  };

  const getAiRecommendation = async () => {
    setAiRecommending(true);
    setAiReason('');
    try {
      const res = await fetch('/api/ai/recommend-petugas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: id })
      });
      const data = await res.json();
      if (data.success && data.recommended_petugas_id) {
        setSelectedPetugas(data.recommended_petugas_id);
        setAiReason(data.reason);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setAiRecommending(false);
    }
  };

  const updateStatus = async (status, extra = {}) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      if (res.ok) {
        await fetchReport();
        setShowRejectForm(false);
        setShowAssignForm(false);
      }
    } catch {} finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-muted-foreground">Laporan tidak ditemukan</p>
      </div>
    );
  }

  const canAccept = report.status === REPORT_STATUS.DIKIRIM;
  const canAssign = report.status === REPORT_STATUS.DITERIMA || report.status === REPORT_STATUS.DIKIRIM;
  const canReject = report.status !== REPORT_STATUS.SELESAI && report.status !== REPORT_STATUS.DITOLAK;

  return (
    <div className="min-h-[80vh] bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-secondary-foreground transition mb-3">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground font-mono">{report.tracking_code}</h1>
                <StatusBadge status={report.status} size="lg" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {REPORT_CATEGORY_LABELS[report.category]} • Dilaporkan {formatDateTime(report.created_at)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Report Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Deskripsi Masalah</h2>
              <p className="text-sm text-secondary-foreground leading-relaxed">{report.description}</p>
            </Card>

            {/* Photos */}
            {report.report_photos?.filter(p => p.type === 'report').length > 0 && (
              <Card className="p-6">
                <ReportPhotoGallery photos={report.report_photos.filter(p => p.type === 'report')} />
              </Card>
            )}

            {/* Location */}
            {(report.address || report.latitude) && (
              <Card className="p-6">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
                  <MapPin className="w-4 h-4 inline mr-1.5" />
                  Lokasi
                </h2>
                {report.address && <p className="text-sm text-secondary-foreground mb-3">{report.address}</p>}
                {report.latitude && report.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-300 font-medium"
                  >
                    Buka di Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </Card>
            )}

            {/* Status History */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">
                <Clock className="w-4 h-4 inline mr-1.5" />
                Riwayat Status
              </h2>
              <div className="space-y-3">
                {(report.status_history || []).map((entry, i) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className={cn(
                      'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0',
                      i === (report.status_history.length - 1) && report.status === REPORT_STATUS.DITOLAK
                        ? 'bg-rose-500'
                        : (i === (report.status_history.length - 1) ? 'bg-emerald-500' : 'bg-muted')
                    )} />
                    <div>
                      <p className="text-sm font-medium text-secondary-foreground">
                        {REPORT_STATUS_LABELS[entry.new_status] || entry.new_status}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.changed_at)}</p>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Right: Sidebar - Info + Actions */}
          <div className="space-y-6">
            {/* Reporter Info */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Pelapor</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 text-sm">
                  <User className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-secondary-foreground">{report.reporter_name}</span>
                </div>
                <div className="flex items-start gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <a 
                    href={`https://wa.me/${report.reporter_phone.replace(/\D/g, '').replace(/^0/, '62')}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-emerald-600 hover:underline"
                  >
                    {report.reporter_phone}
                  </a>
                </div>
              </div>
            </Card>

            {/* Assignment Info */}
            {report.assignments?.length > 0 && (
              <Card className="p-6">
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Ditugaskan ke</h2>
                {report.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 text-sm">
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="font-medium text-secondary-foreground">{a.petugas?.name || 'Petugas'}</p>
                      {a.petugas?.phone && <p className="text-xs text-muted-foreground">{a.petugas.phone}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Actions */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">Aksi</h2>
              <div className="space-y-3">
                {/* Accept */}
                {canAccept && (
                  <Button
                    className="w-full"
                    onClick={() => updateStatus('diterima', { notes: 'Laporan diterima oleh koordinator' })}
                    loading={actionLoading}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Terima Laporan
                  </Button>
                )}

                {/* Assign */}
                {canAssign && !showAssignForm && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShowAssignForm(true)}
                  >
                    <UserPlus className="w-4 h-4" />
                    Tugaskan ke Petugas
                  </Button>
                )}

                {showAssignForm && (
                  <div className="space-y-3 p-4 bg-background rounded-xl">
                    <div className="flex gap-2">
                      <select
                        value={selectedPetugas}
                        onChange={(e) => { setSelectedPetugas(e.target.value); setAiReason(''); }}
                        className="flex-1 px-3 py-2.5 rounded-lg border border-border text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="">Pilih Petugas</option>
                        {petugasList.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="shrink-0 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
                        onClick={getAiRecommendation}
                        loading={aiRecommending}
                        title="Tanya AI untuk rekomendasi petugas terbaik"
                      >
                        ✨ Tanya AI
                      </Button>
                    </div>
                    {aiReason && (
                      <p className="text-xs text-indigo-600 dark:text-indigo-300 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 dark:border-indigo-500/25 italic">
                        {aiReason}
                      </p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        disabled={!selectedPetugas}
                        loading={actionLoading}
                        onClick={() => updateStatus('ditugaskan', { petugas_id: selectedPetugas, notes: 'Ditugaskan oleh koordinator' })}
                      >
                        Assign
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAssignForm(false)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

                {/* Reject */}
                {canReject && !showRejectForm && (
                  <Button
                    variant="danger"
                    className="w-full"
                    onClick={() => setShowRejectForm(true)}
                  >
                    <XCircle className="w-4 h-4" />
                    Tolak Laporan
                  </Button>
                )}

                {showRejectForm && (
                  <div className="space-y-3 p-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Alasan penolakan..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-rose-200 dark:border-rose-500/30 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="danger"
                        className="flex-1"
                        disabled={!rejectReason.trim()}
                        loading={actionLoading}
                        onClick={() => updateStatus('ditolak', { reject_reason: rejectReason, notes: `Ditolak: ${rejectReason}` })}
                      >
                        Konfirmasi Tolak
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowRejectForm(false)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                )}

                {report.status === REPORT_STATUS.SELESAI && (
                  <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl p-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Laporan sudah selesai ditangani</p>
                  </div>
                )}

                {report.status === REPORT_STATUS.DITOLAK && (
                  <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl p-4 text-center">
                    <XCircle className="w-6 h-6 text-rose-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-rose-700 dark:text-rose-300">Laporan ditolak</p>
                    {report.reject_reason && <p className="text-xs text-rose-500 mt-1">{report.reject_reason}</p>}
                  </div>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
