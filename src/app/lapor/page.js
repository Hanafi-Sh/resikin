'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Upload, X, MapPin, Loader2, Camera,
  AlertTriangle, Trash2, Package, Wind, ClipboardList, Leaf,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { REPORT_CATEGORIES, APP_CONFIG } from '@/lib/constants';

const STEPS = ['Kategori', 'Detail', 'Lokasi', 'Kirim'];

const CATEGORY_ICONS = {
  tidak_terangkut: Trash2,
  tps_penuh: Package,
  sampah_liar: AlertTriangle,
  bau: Wind,
  lainnya: ClipboardList,
};

export default function LaporPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiWarning, setAiWarning] = useState('');

  const [formData, setFormData] = useState({
    category: '',
    description: '',
    reporter_name: '',
    reporter_phone: '',
    photos: [],
    photoUrls: [],
    latitude: null,
    longitude: null,
    address: '',
  });

  const [errors, setErrors] = useState({});

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // Photo upload handler
  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (formData.photos.length + files.length > APP_CONFIG.maxPhotos) {
      setErrors(prev => ({ ...prev, photos: `Maksimal ${APP_CONFIG.maxPhotos} foto` }));
      return;
    }

    for (const file of files) {
      if (file.size > APP_CONFIG.maxPhotoSizeMB * 1024 * 1024) {
        setErrors(prev => ({ ...prev, photos: `Ukuran file maksimal ${APP_CONFIG.maxPhotoSizeMB}MB` }));
        return;
      }
    }

    const newPhotos = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setFormData(prev => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos],
    }));
    setErrors(prev => ({ ...prev, photos: '' }));

    // AI Validation (Soft Block)
    setIsAnalyzing(true);
    setAiWarning('');
    try {
      const reader = new FileReader();
      reader.readAsDataURL(files[0]); // Analisis gambar pertama saja
      reader.onload = async () => {
        try {
          const aiRes = await fetch('/api/ai/validate-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: reader.result })
          });
          const aiData = await aiRes.json();
          if (aiData.success && !aiData.isWaste) {
            setAiWarning(`Peringatan AI: Gambar ini terdeteksi sebagai "${aiData.top_label}", bukan masalah sampah. Anda tetap dapat melanjutkan jika merasa AI keliru.`);
          }
        } catch (e) {}
        setIsAnalyzing(false);
      };
    } catch (e) {
      setIsAnalyzing(false);
    }
  };

  const removePhoto = (index) => {
    setFormData(prev => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }));
  };

  // Detect location
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setErrors(prev => ({ ...prev, location: 'Geolocation tidak didukung browser ini' }));
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        updateField('latitude', latitude);
        updateField('longitude', longitude);

        // Reverse geocode for address
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          const data = await res.json();
          if (data.display_name) {
            updateField('address', data.display_name);
          }
        } catch {
          updateField('address', `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        }
        setLoading(false);
      },
      (err) => {
        setErrors(prev => ({ ...prev, location: 'Gagal mendeteksi lokasi. Pastikan izin lokasi aktif.' }));
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Validation per step
  const validateStep = () => {
    const newErrors = {};

    if (step === 0 && !formData.category) {
      newErrors.category = 'Pilih kategori masalah';
    }

    if (step === 1) {
      if (!formData.description || formData.description.trim().length < 10) {
        newErrors.description = 'Deskripsi minimal 10 karakter';
      }
      if (!formData.reporter_name || formData.reporter_name.trim().length < 2) {
        newErrors.reporter_name = 'Nama wajib diisi';
      }
      if (!formData.reporter_phone || formData.reporter_phone.trim().length < 10) {
        newErrors.reporter_phone = 'Nomor HP tidak valid';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) {
      setStep(prev => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const prevStep = () => setStep(prev => Math.max(prev - 1, 0));

  // Submit handler
  const handleSubmit = async () => {
    if (!validateStep()) return;
    setLoading(true);

    try {
      // Upload photos first
      const uploadedUrls = [];
      for (const photo of formData.photos) {
        const uploadForm = new FormData();
        uploadForm.append('file', photo.file);

        const uploadRes = await fetch('/api/upload', { method: 'POST', body: uploadForm });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          uploadedUrls.push(uploadData.url);
        }
      }

      // Submit report
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter_name: formData.reporter_name,
          reporter_phone: formData.reporter_phone,
          category: formData.category,
          description: formData.description,
          latitude: formData.latitude,
          longitude: formData.longitude,
          address: formData.address,
          photo_urls: uploadedUrls,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setTrackingCode(data.tracking_code);
        setSubmitted(true);
      } else {
        setErrors({ submit: data.error || 'Gagal mengirim laporan' });
      }
    } catch (err) {
      setErrors({ submit: 'Terjadi kesalahan. Silakan coba lagi.' });
    } finally {
      setLoading(false);
    }
  };

  // ===== SUCCESS STATE =====
  if (submitted) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-16">
        <Card className="max-w-lg w-full p-10 text-center animate-fade-in-up">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Laporan Berhasil Dikirim!</h1>
          <p className="text-slate-500 mb-6">Terima kasih. Laporan Anda akan segera diproses oleh koordinator kelurahan.</p>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6">
            <p className="text-sm text-emerald-600 font-medium mb-1">Nomor Tracking Anda</p>
            <p className="text-3xl font-bold text-emerald-800 font-mono tracking-wider">{trackingCode}</p>
            <p className="text-xs text-emerald-500 mt-2">Simpan nomor ini untuk melacak status laporan Anda</p>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={() => router.push(`/tracking?code=${trackingCode}`)} className="w-full">
              Lacak Laporan
            </Button>
            <Button variant="secondary" onClick={() => router.push('/')} className="w-full">
              Kembali ke Beranda
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-slate-50 py-12">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Buat Laporan</h1>
          <p className="text-slate-500 mt-2">Laporkan masalah sampah di lingkungan Anda</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center mb-10">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300',
                    i < step
                      ? 'bg-emerald-600 text-white'
                      : i === step
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-slate-200 text-slate-400'
                  )}
                >
                  {i < step ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
                </div>
                <span className={cn(
                  'text-xs mt-1.5 font-medium',
                  i <= step ? 'text-emerald-700' : 'text-slate-400'
                )}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn(
                  'w-12 sm:w-20 h-0.5 mx-1 mt-[-16px]',
                  i < step ? 'bg-emerald-500' : 'bg-slate-200'
                )} />
              )}
            </div>
          ))}
        </div>

        <Card className="p-6 sm:p-8">
          {/* STEP 0: Kategori */}
          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Pilih Kategori Masalah</h2>
              <p className="text-sm text-slate-500 mb-6">Apa jenis masalah sampah yang Anda temui?</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {REPORT_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.value] || ClipboardList;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => updateField('category', cat.value)}
                      className={cn(
                        'flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200',
                        formData.category === cat.value
                          ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        formData.category === cat.value ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={cn(
                        'text-sm font-semibold',
                        formData.category === cat.value ? 'text-emerald-800' : 'text-slate-700'
                      )}>
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {errors.category && (
                <p className="text-sm text-rose-500 mt-3">{errors.category}</p>
              )}
            </div>
          )}

          {/* STEP 1: Detail */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Detail Laporan</h2>
              <p className="text-sm text-slate-500 mb-4">Jelaskan masalah dan tambahkan foto jika ada</p>

              {/* Reporter Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Anda *</label>
                <input
                  type="text"
                  value={formData.reporter_name}
                  onChange={(e) => updateField('reporter_name', e.target.value)}
                  placeholder="Contoh: Bu Sari"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
                {errors.reporter_name && <p className="text-xs text-rose-500 mt-1">{errors.reporter_name}</p>}
              </div>

              {/* Reporter Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nomor HP *</label>
                <input
                  type="tel"
                  value={formData.reporter_phone}
                  onChange={(e) => updateField('reporter_phone', e.target.value)}
                  placeholder="Contoh: 08123456789"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
                {errors.reporter_phone && <p className="text-xs text-rose-500 mt-1">{errors.reporter_phone}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Deskripsi Masalah *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Jelaskan masalah sampah yang Anda temui..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition resize-none"
                />
                {errors.description && <p className="text-xs text-rose-500 mt-1">{errors.description}</p>}
              </div>

              {/* Photo Upload */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Foto Bukti <span className="text-slate-400 font-normal">(opsional, maks {APP_CONFIG.maxPhotos})</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {formData.photos.map((photo, i) => (
                    <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200">
                      <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removePhoto(i)}
                        className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black/80 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {formData.photos.length < APP_CONFIG.maxPhotos && (
                    <label className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition">
                      <Camera className="w-6 h-6 text-slate-400" />
                      <span className="text-xs text-slate-400 mt-1">Tambah</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                {isAnalyzing && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-emerald-600 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI sedang menganalisis gambar...</span>
                  </div>
                )}
                {aiWarning && !isAnalyzing && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 text-sm text-amber-800">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <p>{aiWarning}</p>
                  </div>
                )}
                {errors.photos && <p className="text-xs text-rose-500 mt-1">{errors.photos}</p>}
              </div>
            </div>
          )}

          {/* STEP 2: Lokasi */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Lokasi Masalah</h2>
              <p className="text-sm text-slate-500 mb-4">Tentukan lokasi masalah sampah</p>

              {formData.latitude && formData.longitude ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800 mb-1">Lokasi Terdeteksi</p>
                      <p className="text-sm text-emerald-600">{formData.address}</p>
                      <p className="text-xs text-emerald-500 mt-1">
                        {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={detectLocation}
                  >
                    Deteksi Ulang
                  </Button>
                </div>
              ) : (
                <div className="text-center py-10">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-slate-400" />
                  </div>
                  <p className="text-slate-500 text-sm mb-4">
                    Izinkan akses lokasi untuk menentukan posisi masalah sampah
                  </p>
                  <Button onClick={detectLocation} loading={loading}>
                    <MapPin className="w-4 h-4" />
                    Deteksi Lokasi Saya
                  </Button>
                  {errors.location && (
                    <p className="text-sm text-rose-500 mt-3">{errors.location}</p>
                  )}
                </div>
              )}

              {/* Manual Address Input */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Atau tulis alamat manual
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                  placeholder="Contoh: Jl. Kaliurang KM 5, depan warung Bu Sari"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition"
                />
              </div>
            </div>
          )}

          {/* STEP 3: Review & Kirim */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Periksa Laporan</h2>
              <p className="text-sm text-slate-500 mb-4">Pastikan semua informasi sudah benar sebelum dikirim</p>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Kategori</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {REPORT_CATEGORIES.find(c => c.value === formData.category)?.label}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Pelapor</p>
                  <p className="text-sm font-semibold text-slate-900">{formData.reporter_name}</p>
                  <p className="text-sm text-slate-600">{formData.reporter_phone}</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Deskripsi</p>
                  <p className="text-sm text-slate-700">{formData.description}</p>
                </div>

                {formData.photos.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Foto ({formData.photos.length})</p>
                    <div className="flex gap-2">
                      {formData.photos.map((photo, i) => (
                        <div key={i} className="w-16 h-16 rounded-lg overflow-hidden">
                          <img src={photo.preview} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {formData.address && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Lokasi</p>
                    <p className="text-sm text-slate-700">{formData.address}</p>
                  </div>
                )}
              </div>

              {errors.submit && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-700">
                  {errors.submit}
                </div>
              )}
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-slate-100">
            {step > 0 ? (
              <Button variant="ghost" onClick={prevStep}>
                <ArrowLeft className="w-4 h-4" />
                Kembali
              </Button>
            ) : (
              <div />
            )}

            {step < STEPS.length - 1 ? (
              <Button onClick={nextStep}>
                Lanjut
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} loading={loading}>
                <CheckCircle2 className="w-4 h-4" />
                Kirim Laporan
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
