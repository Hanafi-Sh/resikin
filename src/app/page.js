import Link from 'next/link';
import {
  ClipboardList,
  Search,
  CheckCircle2,
  ArrowRight,
  BarChart3,
  Shield,
  Clock,
  Users,
  FileText,
  Sparkles,
  TrendingUp,
  Leaf,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

// Stat data (placeholder — will be dynamic later)
const stats = [
  { label: 'Laporan Ditangani', value: '1,247', icon: FileText },
  { label: 'Rata-rata Penyelesaian', value: '< 24 Jam', icon: Clock },
  { label: 'Tingkat Penyelesaian', value: '94%', icon: TrendingUp },
  { label: 'Warga Terlayani', value: '3,500+', icon: Users },
];

const steps = [
  {
    step: '01',
    title: 'Laporkan',
    description: 'Isi form sederhana: pilih kategori, tambah foto, tentukan lokasi. Tanpa perlu membuat akun.',
    icon: ClipboardList,
    color: 'bg-emerald-500',
  },
  {
    step: '02',
    title: 'Pantau',
    description: 'Dapatkan nomor tracking unik. Cek status kapan saja — dari "Dikirim" hingga "Selesai".',
    icon: Search,
    color: 'bg-sky-500',
  },
  {
    step: '03',
    title: 'Selesai',
    description: 'Petugas menangani di lapangan. Anda mendapat konfirmasi lengkap dengan foto bukti penyelesaian.',
    icon: CheckCircle2,
    color: 'bg-amber-500',
  },
];

const features = [
  {
    title: 'Tracking Realtime',
    description: 'Pantau setiap perubahan status laporan Anda secara langsung melalui timeline visual.',
    icon: Search,
  },
  {
    title: 'Tanpa Login',
    description: 'Warga bisa langsung melapor tanpa perlu membuat akun. Cukup isi nama dan nomor HP.',
    icon: Sparkles,
  },
  {
    title: 'Dashboard Terpusat',
    description: 'Koordinator kelurahan mengelola semua laporan dari satu dashboard yang mudah digunakan.',
    icon: BarChart3,
  },
  {
    title: 'Data Aman',
    description: 'Semua data tersimpan aman di cloud dengan enkripsi standar industri.',
    icon: Shield,
  },
];

export default function HomePage() {
  return (
    <>
      {/* ============================================
          HERO SECTION
          ============================================ */}
      <section className="relative overflow-hidden bg-gradient-hero min-h-[85vh] flex items-center">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 -left-20 w-60 h-60 bg-emerald-400/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-1/4 w-40 h-40 bg-sky-500/10 rounded-full blur-2xl" />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div className="space-y-8 animate-fade-in-up">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                <Leaf className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-300">
                  Sistem Pelaporan Kelurahan
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight">
                Lingkungan Bersih
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-300">
                  Dimulai dari Laporan Anda
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-lg text-slate-300 leading-relaxed max-w-lg">
                Laporkan masalah sampah di lingkungan Anda dengan mudah. Pantau progress penanganan
                secara realtime. Bersama mewujudkan kelurahan yang lebih bersih.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4">
                <Link href="/lapor">
                  <Button size="xl" className="shadow-lg shadow-emerald-600/25">
                    Laporkan Sekarang
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/tracking">
                  <Button variant="outline" size="xl" className="border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10">
                    Lacak Laporan
                  </Button>
                </Link>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-6 pt-2">
                <div className="flex -space-x-2">
                  {[...'🧑👩🧓👨👩'].map((emoji, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-slate-800 flex items-center justify-center text-sm">
                      {emoji}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-400">
                  <span className="text-emerald-400 font-semibold">3,500+</span> warga sudah melapor
                </p>
              </div>
            </div>

            {/* Right: Visual Card */}
            <div className="hidden lg:block animate-fade-in-up delay-300">
              <div className="relative">
                {/* Main card */}
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 space-y-6">
                  {/* Mini dashboard preview */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold text-sm">Dashboard Hari Ini</p>
                        <p className="text-slate-400 text-xs">23 April 2026</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-full">
                      Live
                    </span>
                  </div>

                  {/* Stats mini cards */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Baru', value: '12', color: 'text-sky-400' },
                      { label: 'Proses', value: '8', color: 'text-amber-400' },
                      { label: 'Selesai', value: '23', color: 'text-emerald-400' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white/5 rounded-xl p-3 text-center">
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Sample report items */}
                  <div className="space-y-3">
                    {[
                      { cat: 'Sampah Tidak Terangkut', status: 'Dalam Proses', statusColor: 'text-amber-400', area: 'RW 05' },
                      { cat: 'TPS Penuh', status: 'Ditugaskan', statusColor: 'text-indigo-400', area: 'RW 02' },
                      { cat: 'Sampah Liar', status: 'Diterima', statusColor: 'text-sky-400', area: 'RW 08' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3">
                        <div>
                          <p className="text-white text-sm font-medium">{item.cat}</p>
                          <p className="text-slate-500 text-xs">{item.area}</p>
                        </div>
                        <span className={`text-xs font-medium ${item.statusColor}`}>{item.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating badge */}
                <div className="absolute -top-4 -right-4 bg-emerald-500 text-white px-4 py-2 rounded-2xl shadow-lg shadow-emerald-500/25 animate-float">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Laporan Selesai!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================
          STATS SECTION
          ============================================ */}
      <section className="relative -mt-12 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {stats.map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 p-5 text-center hover:shadow-xl transition-shadow duration-300"
                >
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          HOW IT WORKS
          ============================================ */}
      <section className="py-24 bg-white" id="cara-kerja">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
              Cara Kerja
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Semudah <span className="text-gradient">3 Langkah</span>
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Tidak perlu download aplikasi. Tidak perlu membuat akun. Langsung laporkan dari browser Anda.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((item, i) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="relative group">
                  {/* Connector line */}
                  {i < steps.length - 1 && (
                    <div className="hidden md:block absolute top-12 left-[60%] w-[calc(100%-20%)] h-0.5 bg-slate-200">
                      <div className="absolute right-0 -top-1 w-2.5 h-2.5 border-r-2 border-t-2 border-slate-300 rotate-45" />
                    </div>
                  )}

                  <Card hover className="text-center p-8 relative overflow-hidden group-hover:border-emerald-200 transition-colors">
                    {/* Step number watermark */}
                    <span className="absolute top-4 right-6 text-7xl font-black text-slate-100 select-none">
                      {item.step}
                    </span>

                    <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg relative z-10`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-3 relative z-10">{item.title}</h3>
                    <p className="text-slate-500 text-sm leading-relaxed relative z-10">{item.description}</p>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          FEATURES
          ============================================ */}
      <section className="py-24 bg-slate-50" id="fitur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
              Fitur Unggulan
            </span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
              Kenapa Pakai <span className="text-gradient">ResikIn</span>?
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
              Didesain khusus untuk kebutuhan koordinasi sampah di level kelurahan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} hover className="p-6 flex gap-5">
                  <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                    <Icon className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{feature.description}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================
          CTA SECTION
          ============================================ */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-emerald rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ada Masalah Sampah di Sekitar Anda?
              </h2>
              <p className="text-emerald-100 text-lg mb-8 max-w-xl mx-auto">
                Jangan didiamkan. Laporkan sekarang dan pantau penanganannya secara langsung.
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link href="/lapor">
                  <Button
                    variant="secondary"
                    size="xl"
                    className="bg-white text-emerald-700 hover:bg-emerald-50 shadow-xl"
                  >
                    Buat Laporan
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/tracking">
                  <Button
                    variant="ghost"
                    size="xl"
                    className="text-white border-2 border-white/30 hover:bg-white/10"
                  >
                    Lacak Laporan
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
