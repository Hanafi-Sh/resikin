import { Leaf, Recycle, Trash2, Calendar, AlertTriangle, Lightbulb, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Link from 'next/link';
import Button from '@/components/ui/Button';

const tips = [
  {
    title: 'Pisahkan Sampah dari Rumah',
    description: 'Pisahkan sampah organik (sisa makanan, daun) dan anorganik (plastik, kertas, kaleng) sebelum dibuang. Ini mempermudah proses daur ulang.',
    icon: Recycle,
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    title: 'Buang Sampah Sesuai Jadwal',
    description: 'Keluarkan sampah hanya pada jadwal pengangkutan yang sudah ditentukan. Jangan menumpuk sampah di depan rumah di luar jadwal.',
    icon: Calendar,
    color: 'bg-sky-100 text-sky-600',
  },
  {
    title: 'Kurangi Penggunaan Plastik Sekali Pakai',
    description: 'Bawa tas belanja sendiri, gunakan botol minum isi ulang, dan hindari sedotan plastik. Plastik membutuhkan ratusan tahun untuk terurai.',
    icon: Trash2,
    color: 'bg-amber-100 text-amber-600',
  },
  {
    title: 'Manfaatkan Sampah Organik',
    description: 'Sisa makanan dan daun bisa dijadikan kompos untuk menyuburkan tanaman. Ini mengurangi volume sampah yang perlu diangkut.',
    icon: Leaf,
    color: 'bg-green-100 text-green-600',
  },
  {
    title: 'Jangan Buang Sampah Sembarangan',
    description: 'Sampah liar mencemari lingkungan, menyumbat saluran air, dan menjadi sarang penyakit. Gunakan tempat sampah yang tersedia.',
    icon: AlertTriangle,
    color: 'bg-rose-100 text-rose-600',
  },
  {
    title: 'Laporkan Masalah Segera',
    description: 'Jika menemukan tumpukan sampah yang tidak terangkut atau TPS penuh, segera laporkan melalui ResikIn agar bisa ditangani.',
    icon: Lightbulb,
    color: 'bg-indigo-100 text-indigo-600',
  },
];

export const metadata = {
  title: 'Informasi Kebersihan — ResikIn',
  description: 'Tips pengelolaan sampah dan informasi kebersihan untuk warga kelurahan.',
};

export default function InfoPage() {
  return (
    <div className="min-h-[80vh] bg-slate-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">
            Informasi Kebersihan
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold text-slate-900">
            Tips & Panduan <span className="text-gradient">Pengelolaan Sampah</span>
          </h1>
          <p className="mt-4 text-lg text-slate-500 max-w-2xl mx-auto">
            Bersama menjaga kebersihan lingkungan dimulai dari langkah kecil di rumah masing-masing.
          </p>
        </div>

        {/* Tips Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {tips.map((tip) => {
            const Icon = tip.icon;
            return (
              <Card key={tip.title} hover className="p-6">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${tip.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{tip.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{tip.description}</p>
              </Card>
            );
          })}
        </div>

        {/* CTA */}
        <div className="text-center bg-white rounded-2xl border border-slate-200 p-8 sm:p-12">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Temukan Masalah Sampah?
          </h2>
          <p className="text-slate-500 mb-6 max-w-md mx-auto">
            Jangan ragu untuk melaporkannya. Setiap laporan membantu menjaga kebersihan lingkungan kita.
          </p>
          <Link href="/lapor">
            <Button size="lg">
              Laporkan Sekarang
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
