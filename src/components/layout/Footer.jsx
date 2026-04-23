import Link from 'next/link';
import { Leaf, Mail, Phone, MapPin } from 'lucide-react';
import { APP_CONFIG } from '@/lib/constants';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-emerald rounded-xl flex items-center justify-center">
                <Leaf className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white tracking-tight">
                {APP_CONFIG.name}
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
              {APP_CONFIG.description}. Bersama menjaga kebersihan lingkungan kelurahan kita.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Navigasi
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/lapor', label: 'Buat Laporan' },
                { href: '/tracking', label: 'Lacak Laporan' },
                { href: '/info', label: 'Informasi Kebersihan' },
                { href: '/login', label: 'Login Petugas' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
              Kontak
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>{APP_CONFIG.kelurahan}, Kota Yogyakarta</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-400">
                <Phone className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>(0274) 000-0000</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-slate-400">
                <Mail className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>kebersihan@kelurahan.go.id</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="py-5 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <p>&copy; {new Date().getFullYear()} {APP_CONFIG.name}. Tim {APP_CONFIG.name} — OmahTI UGM.</p>
          <p>Dibuat dengan 💚 untuk lingkungan yang lebih bersih</p>
        </div>
      </div>
    </footer>
  );
}
