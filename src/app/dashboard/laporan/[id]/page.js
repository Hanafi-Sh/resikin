'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, CheckCircle2, XCircle, UserPlus, MapPin, Clock,
  Phone, User, Loader2, ExternalLink, Image as ImageIcon,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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

  useEffect(() => {
    fetchReport();
    fetchPetugas();
  }, [id]);

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

  const fetchPetugas = async () => {
    try {
      const res = await fetch('/api/users/petugas');
      const data = await res.json();
      setPetugasList(data.petugas || []);
    } catch {}
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
        <p className="text-slate-500">Laporan tidak ditemukan</p>
      </div>
    );
  }

  const canAccept = report.status === REPORT_STATUS.DIKIRIM;
  const canAssign = report.status === REPORT_STATUS.DITERIMA || report.status === REPORT_STATUS.DIKIRIM;
  const canReject = report.status !== REPORT_STATUS.SELESAI && report.status !== REPORT_STATUS.DITOLAK;

  return (
    <div className="min-h-[80vh] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-3">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 font-mono">{report.tracking_code}</h1>
                <StatusBadge status={report.status} size="lg" />
              </div>
              <p className="text-sm text-slate-500 mt-1">
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
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Deskripsi Masalah</h2>
              <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
            </Card>

            {/* Photos */}
            {report.report_photos?.filter(p => p.type === 'report').length > 0 && (
              <Card className="p-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  <ImageIcon className="w-4 h-4 inline mr-1.5" />
                  Foto Laporan
                </h2>
                <div className="grid grid-cols-3 gap-3">
                  {report.report_photos.filter(p => p.type === 'report').map((photo) => (
                    <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener" className="block rounded-xl overflow-hidden border border-slate-200 hover:border-emerald-300 transition aspect-square">
                      <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Location */}
            {(report.address || report.latitude) && (
              <Card className="p-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  <MapPin className="w-4 h-4 inline mr-1.5" />
                  Lokasi
                </h2>
                {report.address && <p className="text-sm text-slate-700 mb-3">{report.address}</p>}
                {report.latitude && report.longitude && (
                  <a
                    href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                  >
                    Buka di Google Maps
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </Card>
            )}

            {/* Status History */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                <Clock className="w-4 h-4 inline mr-1.5" />
                Riwayat Status
              </h2>
              <div className="space-y-3">
                {(report.status_history || []).map((entry, i) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className={cn(
                      'w-2.5 h-2.5 rounded-full mt-1.5 shrink-0',
                      i === (report.status_history.length - 1) ? 'bg-emerald-500' : 'bg-slate-300'
                    )} />
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {REPORT_STATUS_LABELS[entry.new_status] || entry.new_status}
                      </p>
                      <p className="text-xs text-slate-400">{formatDateTime(entry.changed_at)}</p>
                      {entry.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{entry.notes}</p>}
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
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Pelapor</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 text-sm">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <span className="text-slate-700 leading-none pt-[1px]">{report.reporter_name}</span>
                </div>
                <div className="flex items-center gap-2.5 text-sm">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <a href={`tel:${report.reporter_phone}`} className="text-emerald-600 hover:underline leading-none pt-[1px]">{report.reporter_phone}</a>
                </div>
              </div>
            </Card>

            {/* Assignment Info */}
            {report.assignments?.length > 0 && (
              <Card className="p-6">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Ditugaskan ke</h2>
                {report.assignments.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 text-sm">
                    <UserPlus className="w-4 h-4 text-indigo-500" />
                    <div>
                      <p className="font-medium text-slate-700">{a.petugas?.name || 'Petugas'}</p>
                      {a.petugas?.phone && <p className="text-xs text-slate-400">{a.petugas.phone}</p>}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {/* Actions */}
            <Card className="p-6">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Aksi</h2>
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
                  <div className="space-y-3 p-4 bg-slate-50 rounded-xl">
                    <select
                      value={selectedPetugas}
                      onChange={(e) => setSelectedPetugas(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Pilih Petugas</option>
                      {petugasList.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                  <div className="space-y-3 p-4 bg-rose-50 rounded-xl">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Alasan penolakan..."
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-rose-200 text-sm focus:ring-2 focus:ring-rose-500 outline-none resize-none"
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
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-emerald-700">Laporan sudah selesai ditangani</p>
                  </div>
                )}

                {report.status === REPORT_STATUS.DITOLAK && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-center">
                    <XCircle className="w-6 h-6 text-rose-500 mx-auto mb-1" />
                    <p className="text-sm font-medium text-rose-700">Laporan ditolak</p>
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
