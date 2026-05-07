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

export const KELURAHAN_OPTIONS = [
  { id: 'bausasran', name: 'Bausasran', kemantren: 'Danurejan' },
  { id: 'suryatmajan', name: 'Suryatmajan', kemantren: 'Danurejan' },
  { id: 'tegalpanggung', name: 'Tegalpanggung', kemantren: 'Danurejan' },
  { id: 'pringgokusuman', name: 'Pringgokusuman', kemantren: 'Gedongtengen' },
  { id: 'sosromenduran', name: 'Sosromenduran', kemantren: 'Gedongtengen' },
  { id: 'baciro', name: 'Baciro', kemantren: 'Gondokusuman' },
  { id: 'demangan', name: 'Demangan', kemantren: 'Gondokusuman' },
  { id: 'klitren', name: 'Klitren', kemantren: 'Gondokusuman' },
  { id: 'kotabaru', name: 'Kotabaru', kemantren: 'Gondokusuman' },
  { id: 'terban', name: 'Terban', kemantren: 'Gondokusuman' },
  { id: 'ngupasan', name: 'Ngupasan', kemantren: 'Gondomanan' },
  { id: 'prawirodirjan', name: 'Prawirodirjan', kemantren: 'Gondomanan' },
  { id: 'bumijo', name: 'Bumijo', kemantren: 'Jetis' },
  { id: 'cokrodiningratan', name: 'Cokrodiningratan', kemantren: 'Jetis' },
  { id: 'gowongan', name: 'Gowongan', kemantren: 'Jetis' },
  { id: 'prenggan', name: 'Prenggan', kemantren: 'Kotagede' },
  { id: 'purbayan', name: 'Purbayan', kemantren: 'Kotagede' },
  { id: 'rejowinangun', name: 'Rejowinangun', kemantren: 'Kotagede' },
  { id: 'kadipaten', name: 'Kadipaten', kemantren: 'Kraton' },
  { id: 'panembahan', name: 'Panembahan', kemantren: 'Kraton' },
  { id: 'patehan', name: 'Patehan', kemantren: 'Kraton' },
  { id: 'gedongkiwo', name: 'Gedongkiwo', kemantren: 'Mantrijeron' },
  { id: 'mantrijeron', name: 'Mantrijeron', kemantren: 'Mantrijeron' },
  { id: 'suryodiningratan', name: 'Suryodiningratan', kemantren: 'Mantrijeron' },
  { id: 'brontokusuman', name: 'Brontokusuman', kemantren: 'Mergangsan' },
  { id: 'keparakan', name: 'Keparakan', kemantren: 'Mergangsan' },
  { id: 'wirogunan', name: 'Wirogunan', kemantren: 'Mergangsan' },
  { id: 'ngampilan', name: 'Ngampilan', kemantren: 'Ngampilan' },
  { id: 'notoprajan', name: 'Notoprajan', kemantren: 'Ngampilan' },
  { id: 'gunungketur', name: 'Gunungketur', kemantren: 'Pakualaman' },
  { id: 'purwokinanti', name: 'Purwokinanti', kemantren: 'Pakualaman' },
  { id: 'bener', name: 'Bener', kemantren: 'Tegalrejo' },
  { id: 'karangwaru', name: 'Karangwaru', kemantren: 'Tegalrejo' },
  { id: 'kricak', name: 'Kricak', kemantren: 'Tegalrejo' },
  { id: 'tegalrejo', name: 'Tegalrejo', kemantren: 'Tegalrejo' },
  { id: 'giwangan', name: 'Giwangan', kemantren: 'Umbulharjo' },
  { id: 'muja-muju', name: 'Muja Muju', kemantren: 'Umbulharjo' },
  { id: 'pandeyan', name: 'Pandeyan', kemantren: 'Umbulharjo' },
  { id: 'semaki', name: 'Semaki', kemantren: 'Umbulharjo' },
  { id: 'sorosutan', name: 'Sorosutan', kemantren: 'Umbulharjo' },
  { id: 'tahunan', name: 'Tahunan', kemantren: 'Umbulharjo' },
  { id: 'warungboto', name: 'Warungboto', kemantren: 'Umbulharjo' },
  { id: 'pakuncen', name: 'Pakuncen', kemantren: 'Wirobrajan' },
  { id: 'patangpuluhan', name: 'Patangpuluhan', kemantren: 'Wirobrajan' },
  { id: 'wirobrajan', name: 'Wirobrajan', kemantren: 'Wirobrajan' },
];

export const KELURAHAN_IDS = new Set(KELURAHAN_OPTIONS.map((kelurahan) => kelurahan.id));

export const USER_ROLES = {
  KOORDINATOR: 'koordinator',
  PETUGAS: 'petugas',
};

export const NAV_ITEMS = {
  public: [
    { href: '/', label: 'Beranda' },
    { href: '/lapor', label: 'Laporkan' },
    { href: '/telegram', label: 'Bot Telegram' },
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
  telegramBotUsername: 'resikinbot',
  telegramBotUrl: 'https://t.me/resikinbot',
};
