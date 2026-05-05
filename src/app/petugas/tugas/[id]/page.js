'use client';

import { useState, useEffect, use, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Navigation, Camera, CheckCircle2, Truck,
  Loader2, ExternalLink, Clock, X,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ReportPhotoGallery from '@/components/ui/ReportPhotoGallery';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn, formatDateTime } from '@/lib/utils';
import { REPORT_STATUS_LABELS, REPORT_CATEGORY_LABELS, REPORT_STATUS } from '@/lib/constants';

const PETUGAS_ACTIONS = [
  { status: 'dalam_proses', label: 'Menuju / Sedang Dikerjakan', icon: Truck, notes: 'Petugas menuju lokasi' },
  { status: 'selesai', label: 'Selesai', icon: CheckCircle2, notes: 'Masalah sudah ditangani' },
];

export default function TugasDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [completionPhotos, setCompletionPhotos] = useState([]);
  const [actionError, setActionError] = useState('');

  const fetchAssignment = useCallback(async () => {
    try {
      const res = await fetch('/api/assignments');
      if (res.status === 401) { router.push('/login'); return; }
      const data = await res.json();
      const found = (data.assignments || []).find(a => a.id === id);
      setAssignment(found || null);
    } catch {} finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAssignment();
  }, [fetchAssignment]);

  const handleStatusUpdate = async (newStatus, notes) => {
    if (!assignment?.report?.id) return;
    setActionLoading(true);
    setActionError('');

    try {
      // Upload completion photos if marking as selesai
      if (newStatus === 'selesai' && completionPhotos.length > 0) {
        for (const photo of completionPhotos) {
          const formData = new FormData();
          formData.append('file', photo.file);
          formData.append('report_id', assignment.report.id);
          formData.append('type', 'completion');
          const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
          const uploadData = await uploadRes.json();

          if (!uploadRes.ok || !uploadData.success) {
            throw new Error(uploadData.error || 'Foto bukti penyelesaian gagal diunggah');
          }
        }
        setCompletionPhotos([]);
      }

      // Update report status
      const res = await fetch(`/api/reports/${assignment.report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Status tugas gagal diperbarui');
      }

      await fetchAssignment();
    } catch (error) {
      setActionError(error.message || 'Terjadi kesalahan saat memperbarui tugas. Silakan coba lagi.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setCompletionPhotos(prev => [...prev, ...newPhotos].slice(0, 3));
  };

  const removePhoto = (index) => {
    setCompletionPhotos(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!assignment || !assignment.report) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <p className="text-slate-500">Tugas tidak ditemukan</p>
      </div>
    );
  }

  const report = assignment.report;
  const isCompleted = report.status === REPORT_STATUS.SELESAI;

  return (
    <div className="min-h-[80vh] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4">
          <Link href="/petugas" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition mb-3">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Tugas
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-900 font-mono">{report.tracking_code}</h1>
            <StatusBadge status={report.status} size="lg" />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {REPORT_CATEGORY_LABELS[report.category]} • Ditugaskan {formatDateTime(assignment.assigned_at)}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Description */}
        <Card className="p-6">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Detail Masalah</h2>
          <p className="text-sm text-slate-700 leading-relaxed">{report.description}</p>
        </Card>

        {/* Photos */}
        {report.report_photos?.filter(p => p.type === 'report').length > 0 && (
          <Card className="p-6">
            <ReportPhotoGallery photos={report.report_photos.filter(p => p.type === 'report')} />
          </Card>
        )}

        {report.report_photos?.filter(p => p.type === 'completion').length > 0 && (
          <Card className="p-6">
            <ReportPhotoGallery
              photos={report.report_photos.filter(p => p.type === 'completion')}
              title="Foto Bukti Penyelesaian"
            />
          </Card>
        )}

        {/* Location + Navigation */}
        {(report.address || report.latitude) && (
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">Lokasi</h2>
            {report.address && <p className="text-sm text-slate-700 mb-4">{report.address}</p>}
            {report.latitude && report.longitude && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" className="w-full">
                  <Navigation className="w-4 h-4" />
                  Navigasi ke Lokasi
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            )}
          </Card>
        )}

        {/* Action Section */}
        {!isCompleted && (
          <Card className="p-6">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Update Status</h2>

            {actionError && (
              <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {actionError}
              </div>
            )}

            {/* Upload completion photos */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Foto Bukti Penyelesaian <span className="text-slate-400 font-normal">(opsional)</span>
              </label>
              <div className="flex flex-wrap gap-3">
                {completionPhotos.map((photo, i) => (
                  <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                    <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                    <button onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {completionPhotos.length < 3 && (
                  <label className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 transition">
                    <Camera className="w-5 h-5 text-slate-400" />
                    <span className="text-xs text-slate-400 mt-0.5">Foto</span>
                    <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Status buttons */}
            <div className="space-y-3">
              {PETUGAS_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isActive = report.status === action.status;
                const isSelesai = action.status === 'selesai';

                return (
                  <Button
                    key={action.status}
                    variant={isSelesai ? 'primary' : 'secondary'}
                    className="w-full"
                    disabled={isActive}
                    loading={actionLoading}
                    onClick={() => handleStatusUpdate(action.status, action.notes)}
                  >
                    <Icon className="w-4 h-4" />
                    {isActive ? `Status: ${action.label}` : action.label}
                  </Button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Completed State */}
        {isCompleted && (
          <Card className="p-6 text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-bold text-emerald-800 mb-1">Tugas Selesai!</h3>
            <p className="text-sm text-emerald-600">Terima kasih telah menangani laporan ini.</p>
            {assignment.completed_at && (
              <p className="text-xs text-slate-400 mt-2">Diselesaikan {formatDateTime(assignment.completed_at)}</p>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
