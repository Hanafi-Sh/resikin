'use client';

import { useState, useEffect } from 'react';
import { Search, CheckCircle2, Clock, AlertCircle, Truck, ClipboardCheck, XCircle, ArrowRight, ArrowLeft, Leaf } from 'lucide-react';
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

export default function TrackingClient({ initialCode = '', initialReport = null, initialError = '' }) {
  const [code, setCode] = useState(initialCode);
  const [report, setReport] = useState(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [searched, setSearched] = useState(Boolean(initialCode));
  const [recentReports, setRecentReports] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

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

  // Fetch recent reports.
  useEffect(() => {
    let ignore = false;

    async function loadRecentReports() {
      try {
        const res = await fetch('/api/public-reports?limit=5');
        const data = await res.json();
        if (!ignore && res.ok) setRecentReports(data.reports || []);
      } catch (err) {
        console.error('Failed to fetch recent reports', err);
      } finally {
        if (!ignore) setLoadingRecent(false);
      }
    }

    loadRecentReports();
    return () => {
      ignore = true;
    };
  }, []);

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
            {/* Back Button */}
            <button 
              onClick={() => {
                setReport(null);
                setSearched(false);
                setCode('');
              }}
              className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-emerald-600 transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Daftar Laporan
            </button>

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

        {/* Recent Reports / Transparency Section */}
        {!report && (
          <div className="mt-12 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Laporan Terbaru</h2>
                <p className="text-sm text-slate-500">Transparansi penanganan sampah di kelurahan kita</p>
              </div>
            </div>

            {loadingRecent ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-5 animate-pulse flex gap-4">
                    <div className="w-12 h-12 bg-slate-200 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-3 py-1">
                      <div className="h-4 bg-slate-200 rounded w-1/3" />
                      <div className="h-3 bg-slate-200 rounded w-2/3" />
                    </div>
                  </Card>
                ))}
              </div>
            ) : recentReports.length > 0 ? (
              <div className="space-y-4">
                {recentReports.map(item => (
                  <Card 
                    key={item.id} 
                    hover 
                    className="p-5 cursor-pointer transition-all hover:border-emerald-200 group"
                    onClick={() => {
                      setCode(item.tracking_code);
                      handleSearch(item.tracking_code);
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mb-1.5">
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                            {item.tracking_code}
                          </span>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">
                            {formatDateTime(item.created_at)}
                          </span>
                        </div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {REPORT_CATEGORY_LABELS[item.category] || item.category}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">{item.description}</p>
                        {item.address && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-400">
                            <span className="shrink-0">📍</span>
                            <span className="truncate">{item.address}</span>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right flex flex-col items-end gap-2">
                        <StatusBadge status={item.status} size="sm" />
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center text-slate-500">
                <Leaf className="w-8 h-8 mx-auto text-emerald-200 mb-2" />
                <p>Belum ada laporan terbaru.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
