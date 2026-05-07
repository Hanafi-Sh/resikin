import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  ClipboardList,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  Send,
  ShieldCheck,
  FileCheck,
} from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { APP_CONFIG } from '@/lib/constants';

export const metadata = {
  title: 'Panduan Bot Telegram — ResikIn',
  description: 'Panduan menggunakan resikinbot untuk melaporkan masalah sampah melalui Telegram.',
};

const intakeSteps = [
  {
    title: 'Buka bot',
    description: `Mulai percakapan dengan @${APP_CONFIG.telegramBotUsername} di Telegram.`,
    icon: Bot,
  },
  {
    title: 'Mulai laporan',
    description: 'Pilih menu membuat laporan agar bot mulai mengumpulkan Draf Laporan.',
    icon: MessageCircle,
  },
  {
    title: 'Isi nomor HP',
    description: 'Nomor digunakan bila petugas perlu menghubungi Pelapor untuk tindak lanjut.',
    icon: Phone,
  },
  {
    title: 'Pilih kelurahan dan kategori',
    description: 'Tentukan Kelurahan Laporan dan jenis masalah sampah yang ditemukan.',
    icon: ClipboardList,
  },
  {
    title: 'Kirim foto atau lewati',
    description: 'Tambahkan Foto Laporan bila ada. Jika tidak ada, bot tetap bisa melanjutkan alur.',
    icon: Camera,
  },
  {
    title: 'Bagikan lokasi',
    description: 'Kirim titik lokasi agar laporan bisa diarahkan ke wilayah dan petugas yang tepat.',
    icon: MapPin,
  },
  {
    title: 'Konfirmasi laporan',
    description: 'Periksa ringkasan dari bot. Setelah dikonfirmasi, Draf Laporan menjadi Laporan Terkirim.',
    icon: CheckCircle2,
  },
  {
    title: 'Simpan Kode Tracking',
    description: 'Gunakan Kode Tracking untuk memantau perubahan status penanganan laporan.',
    icon: Search,
  },
];

const notes = [
  'Gunakan foto yang jelas agar kelurahan dan petugas lebih mudah memahami kondisi di lapangan.',
  'Lokasi wajib dibagikan supaya titik masalah sampah tidak tertukar.',
  'Laporan baru dikirim ke sistem setelah Pelapor mengonfirmasi ringkasan dari bot.',
];

export default function TelegramGuidePage() {
  return (
    <div className="min-h-[80vh] bg-background">
      <section className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
          <div className="grid lg:grid-cols-[1fr_0.85fr] gap-10 items-center">
            <div>
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 uppercase tracking-wider">
                <Send className="w-4 h-4" />
                Laporan Intake Telegram
              </span>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
                Melapor lewat Telegram dengan <span className="text-gradient">@{APP_CONFIG.telegramBotUsername}</span>
              </h1>
              <p className="mt-5 text-lg text-muted-foreground leading-relaxed">
                ResikIn menyediakan bot Telegram resmi untuk warga yang ingin melaporkan masalah sampah
                tanpa membuka form web. Bot akan memandu Pelapor sampai laporan valid tersimpan dan bisa dilacak.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href={APP_CONFIG.telegramBotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all duration-200 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98]"
                >
                  Buka @{APP_CONFIG.telegramBotUsername}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Link href="/tracking">
                  <Button variant="outline" size="lg">
                    Lacak Laporan
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-6 shadow-sm">
              <div className="flex items-center gap-3 border-b border-border pb-4">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-emerald-600 dark:text-emerald-300" />
                </div>
                <div>
                  <p className="font-bold text-foreground">@{APP_CONFIG.telegramBotUsername}</p>
                  <p className="text-sm text-muted-foreground">Bot pelaporan sampah ResikIn</p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {[
                  'Pilih kelurahan laporan',
                  'Kirim foto dan deskripsi',
                  'Bagikan titik lokasi',
                  'Terima Kode Tracking',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="text-sm font-medium text-secondary-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-center">
            <span className="text-lg font-semibold text-emerald-600 uppercase tracking-wider">
              Alur Pelaporan
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-foreground text-center leading-relaxed">
              Dari Draf Laporan sampai Laporan <span className="text-gradient">Terkirim</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {intakeSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} hover className="p-6 shadow-sm shadow-slate-200/50">
                  <div className="flex items-center justify-between mb-5 relative">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-300" />
                    </div>
                    <span className="text-lg font-bold select-none">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="pb-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="p-6 md:p-8 flex flex-col items-center text-center justify-center md:h-auto">
              <div className="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-500/10 flex items-center justify-center mb-4">
                <ShieldCheck className="w-6 h-6 text-sky-600 dark:text-sky-300" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">Data untuk tindak lanjut</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Data laporan digunakan untuk verifikasi kelurahan, penugasan, dan komunikasi penanganan.
                Nomor HP membantu petugas saat membutuhkan klarifikasi lokasi atau kondisi lapangan.
              </p>
            </Card>

            <Card className="p-6 md:p-8 flex flex-col items-center text-center md:h-auto">
              <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center mb-4">
                <FileCheck className="w-6 h-6 text-orange-600 dark:text-orange-300" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-4">Yang perlu disiapkan</h3>
              <div className="grid sm:grid-cols-3 gap-3">
                {notes.map((note) => (
                  <div key={note} className="rounded-xl border border-border bg-background p-4 flex items-center">
                    <p className="text-sm text-secondary-foreground leading-relaxed">{note}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
