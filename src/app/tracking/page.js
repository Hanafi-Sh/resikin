'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, CheckCircle2, Clock, AlertCircle, Truck, ClipboardCheck, XCircle, ArrowRight, Leaf } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn, formatDateTime } from '@/lib/utils';
import { REPORT_STATUS, REPORT_STATUS_LABELS, REPORT_CATEGORY_LABELS } from '@/lib/constants';

const STATUS_ICONS = {
  [REPORT_STATUS.DIKIRIM]: Clock,
  [REPORT_STATUS.DITERIMA]: ClipboardCheck,
  [REPORT_STATUS.DITUGASKAN]: Truck,
  [REPORT_STATUS.DALAM_PROSES]: Truck,
  [REPORT_STATUS.SELESAI]: CheckCircle2,
  [REPORT_STATUS.DITOLAK]: XCircle,
};

const STATUS_ORDER = [
  REPORT_STATUS.DIKIRIM,
  REPORT_STATUS.DITERIMA,
  REPORT_STATUS.DITUGASKAN,
  REPORT_STATUS.DALAM_PROSES,
  REPORT_STATUS.SELESAI,
];

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // Auto-search if code in URL
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode) {
      setCode(urlCode);
      handleSearch(urlCode);
    }
  }, []);

  const handleSearch = async (searchCode) => {
    const trackingCode = (searchCode || code).trim().toUpperCase();
    if (!trackingCode) {
      setError('Masukkan nomor tracking');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const res = await fetch(`/api/tracking/${trackingCode}`);
      const data = await res.json();

      if (res.ok) {
        setReport(data.report);
      } else {
        setReport(null);
        setError(data.error || 'Laporan tidak ditemukan');
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIndex = (status) => STATUS_ORDER.indexOf(status);
  const isRejected = report?.status === REPORT_STATUS.DITOLAK;
  const currentStatusIndex = report ? getStatusIndex(report.status) : -1;

  return (
    <div className="min-h-[80vh] bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Lacak Laporan</h1>
          <p className="text-slate-500 mt-2">Masukkan nomor tracking untuk melihat status laporan Anda</p>
        </div>

        {/* Search Box */}
        <Card className="p-6 mb-8">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Contoh: RSK-20260423-001"
                className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-slate-200 text-sm font-mono tracking-wider focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
              />
            </div>
            <Button onClick={() => handleSearch()} loading={loading} className="shrink-0">
              Lacak
            </Button>
          </div>
          {error && <p className="text-sm text-rose-500 mt-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" />{error}</p>}
        </Card>

        {/* Results */}
        {report && (
          <div className="animate-fade-in-up space-y-6">
            {/* Report Summary */}
            <Card className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-500 font-mono">{report.tracking_code}</p>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">
                    {REPORT_CATEGORY_LABELS[report.category] || report.category}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">{report.description}</p>
                </div>
                <StatusBadge status={report.status} size="lg" />
              </div>

              {report.address && (
                <div className="text-sm text-slate-500 flex items-start gap-2 mt-3 pt-3 border-t border-slate-100">
                  <span className="shrink-0">📍</span>
                  <span>{report.address}</span>
                </div>
              )}

              {/* Report Photos */}
              {report.report_photos?.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Foto Laporan</p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {report.report_photos.filter(p => p.type === 'report').map((photo) => (
                      <div key={photo.id} className="w-20 h-20 rounded-lg overflow-hidden shrink-0 border border-slate-200">
                        <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* Status Timeline */}
            <Card className="p-6">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">
                Timeline Status
              </h3>

              {!isRejected ? (
                <div className="space-y-0">
                  {STATUS_ORDER.map((status, i) => {
                    const isActive = i <= currentStatusIndex;
                    const isCurrent = i === currentStatusIndex;
                    const Icon = STATUS_ICONS[status];
                    const historyEntry = report.status_history?.find(h => h.new_status === status);

                    return (
                      <div key={status} className="flex gap-4">
                        {/* Line & Dot */}
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all',
                            isCurrent
                              ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                              : isActive
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 text-slate-400'
                          )}>
                            <Icon className="w-5 h-5" />
                          </div>
                          {i < STATUS_ORDER.length - 1 && (
                            <div className={cn(
                              'w-0.5 h-12 my-1',
                              i < currentStatusIndex ? 'bg-emerald-400' : 'bg-slate-200'
                            )} />
                          )}
                        </div>

                        {/* Content */}
                        <div className={cn('pb-8', i === STATUS_ORDER.length - 1 && 'pb-0')}>
                          <p className={cn(
                            'text-sm font-bold',
                            isActive ? 'text-slate-900' : 'text-slate-400'
                          )}>
                            {REPORT_STATUS_LABELS[status]}
                          </p>
                          {historyEntry && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {formatDateTime(historyEntry.changed_at)}
                            </p>
                          )}
                          {historyEntry?.notes && (
                            <p className="text-xs text-slate-400 mt-0.5 italic">{historyEntry.notes}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Rejected State */
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-6 h-6 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-sm font-bold text-rose-800">Laporan Ditolak</p>
                      {report.reject_reason && (
                        <p className="text-sm text-rose-600 mt-1">Alasan: {report.reject_reason}</p>
                      )}
                      <p className="text-xs text-rose-400 mt-2">
                        Jika Anda merasa ini keliru, silakan buat laporan baru dengan informasi yang lebih lengkap.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Completion photos */}
            {report.report_photos?.filter(p => p.type === 'completion').length > 0 && (
              <Card className="p-6">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
                  Foto Bukti Penyelesaian
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {report.report_photos.filter(p => p.type === 'completion').map((photo) => (
                    <div key={photo.id} className="w-32 h-32 rounded-xl overflow-hidden shrink-0 border border-slate-200">
                      <img src={photo.photo_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Empty State */}
        {searched && !report && !loading && !error && (
          <Card className="p-10 text-center">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">Laporan tidak ditemukan</p>
          </Card>
        )}

        {/* Help Text */}
        {!searched && (
          <div className="text-center text-sm text-slate-400 mt-8">
            <p>Nomor tracking diberikan saat Anda mengirim laporan.</p>
            <p className="mt-1">Formatnya: <span className="font-mono text-slate-500">RSK-YYYYMMDD-NNN</span></p>
          </div>
        )}
      </div>
    </div>
  );
}
