const fs = require('fs');
const file = '/home/han/Desktop/Kuliah/OmahTi/Internship 2026/resikin/src/app/lapor/page.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace("const STEPS = ['Kategori', 'Detail', 'Lokasi', 'Kirim'];", "const STEPS = ['Foto & Detail', 'Kategori', 'Lokasi', 'Kirim'];");

const oldValidation = `  const validateStep = () => {
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
  };`;

const newValidation = `  const validateStep = () => {
    const newErrors = {};

    if (step === 1 && !formData.category) {
      newErrors.category = 'Pilih kategori masalah';
    }

    if (step === 0) {
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
  };`;

content = content.replace(oldValidation, newValidation);

const oldJSX = content.substring(content.indexOf('          {/* STEP 0: Kategori */}'), content.indexOf('          {/* STEP 2: Lokasi */}'));

const newJSX = `          {/* STEP 0: Detail */}
          {step === 0 && (
            <div className="space-y-5 animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Detail Laporan & Foto</h2>
              <p className="text-sm text-slate-500 mb-4">Jelaskan masalah dan tambahkan foto jika ada</p>

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
                {/* Info Text for AI */}
                {formData.photos.length === 0 && (
                   <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                     <span className="text-emerald-500">✨</span> Unggah foto agar AI Assistant dapat menyarankan kategori secara otomatis.
                   </p>
                )}
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
            </div>
          )}

          {/* STEP 1: Kategori */}
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Pilih Kategori Masalah</h2>
              <p className="text-sm text-slate-500 mb-4">Apa jenis masalah sampah yang Anda temui?</p>

              {/* Info Text for AI in Category Step */}
              {formData.photos.length > 0 && formData.category && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3 text-sm text-indigo-700">
                  <span className="text-lg">🤖</span>
                  <p>AI telah menyarankan kategori berdasarkan foto Anda. Anda tetap bebas mengubahnya jika dirasa kurang sesuai.</p>
                </div>
              )}

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

`;

content = content.replace(oldJSX, newJSX);
fs.writeFileSync(file, content);
console.log('Done!');
