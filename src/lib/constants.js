// ============================================
// ResikIn — Constants & Enums
// ============================================

export const REPORT_STATUS = {
  DIKIRIM: 'dikirim',
  DITERIMA: 'diterima',
  DITUGASKAN: 'ditugaskan',
  DALAM_PROSES: 'dalam_proses',
  SELESAI: 'selesai',
  DITOLAK: 'ditolak',
};

export const REPORT_STATUS_LABELS = {
  [REPORT_STATUS.DIKIRIM]: 'Dikirim',
  [REPORT_STATUS.DITERIMA]: 'Diterima',
  [REPORT_STATUS.DITUGASKAN]: 'Ditugaskan',
  [REPORT_STATUS.DALAM_PROSES]: 'Dalam Proses',
  [REPORT_STATUS.SELESAI]: 'Selesai',
  [REPORT_STATUS.DITOLAK]: 'Ditolak',
};

export const REPORT_STATUS_COLORS = {
  [REPORT_STATUS.DIKIRIM]: { bg: 'bg-muted', text: 'text-secondary-foreground', dot: 'bg-status-dikirim' },
  [REPORT_STATUS.DITERIMA]: { bg: 'bg-sky-50 dark:bg-sky-500/10', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-status-diterima' },
  [REPORT_STATUS.DITUGASKAN]: { bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-status-ditugaskan' },
  [REPORT_STATUS.DALAM_PROSES]: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-status-dalam-proses' },
  [REPORT_STATUS.SELESAI]: { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-status-selesai' },
  [REPORT_STATUS.DITOLAK]: { bg: 'bg-rose-50 dark:bg-rose-500/10', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-status-ditolak' },
};

export const REPORT_CATEGORIES = [
  { value: 'tidak_terangkut', label: 'Sampah Tidak Terangkut', icon: '🗑️' },
  { value: 'tps_penuh', label: 'TPS Penuh', icon: '📦' },
  { value: 'sampah_liar', label: 'Sampah Liar / Ilegal Dumping', icon: '⚠️' },
  { value: 'bau', label: 'Bau Tidak Sedap', icon: '💨' },
  { value: 'lainnya', label: 'Lainnya', icon: '📋' },
];

export const REPORT_CATEGORY_LABELS = Object.fromEntries(
  REPORT_CATEGORIES.map((c) => [c.value, c.label])
);

export const USER_ROLES = {
  KOORDINATOR: 'koordinator',
  PETUGAS: 'petugas',
};

export const NAV_ITEMS = {
  public: [
    { href: '/', label: 'Beranda' },
    { href: '/lapor', label: 'Laporkan' },
    { href: '/tracking', label: 'Lacak Laporan' },
    { href: '/info', label: 'Informasi' },
  ],
  koordinator: [
    { href: '/dashboard', label: 'Dashboard' },
  ],
  petugas: [
    { href: '/petugas', label: 'Tugas Saya' },
  ],
};

export const APP_CONFIG = {
  name: 'ResikIn',
  tagline: 'Laporkan. Pantau. Bersihkan.',
  description: 'Sistem Pelaporan & Koordinasi Sampah Kelurahan Kota Yogyakarta',
  kelurahan: 'Kelurahan Terban', // placeholder — sesuaikan
  maxPhotos: 3,
  maxPhotoSizeMB: 5,
  trackingCodePrefix: 'RSK',
};
