'use client';

import { useState } from 'react';
import { Send, Key, ExternalLink, Check, Copy, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function TelegramLinkCard() {
  const [token, setToken] = useState(null);
  const [deepLink, setDeepLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const generateToken = async () => {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch('/api/telegram/link-token', { method: 'POST' });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Gagal membuat token OTP');
      }
      
      setToken(data.token);
      setDeepLink(data.deep_link);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-white to-sky-50/50 border-sky-100 relative overflow-hidden">
      {/* Decorative background element */}
      <div className="absolute -right-6 -top-6 text-sky-100 opacity-50 transform rotate-12 pointer-events-none">
        <Send className="w-32 h-32" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Send className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Hubungkan Notifikasi Telegram</h2>
            <p className="text-sm text-slate-500 mt-1">
              Dapatkan notifikasi langsung di Telegram ketika ada laporan baru di wilayah Anda.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {!token ? (
          <Button 
            onClick={generateToken} 
            loading={loading}
            className="w-full sm:w-auto bg-sky-600 hover:bg-sky-700 text-white"
          >
            <Key className="w-4 h-4 mr-2" />
            Generate Kode OTP
          </Button>
        ) : (
          <div className="bg-white rounded-xl border border-sky-200 p-4 shadow-sm animate-fade-in-up">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kode OTP Anda</p>
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-200 mb-4">
              <code className="text-xl font-mono font-bold text-sky-700 tracking-widest">{token}</code>
              <button 
                onClick={copyToClipboard}
                className="p-2 hover:bg-slate-200 rounded-md transition-colors text-slate-500"
                title="Salin Kode"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            
            <p className="text-sm text-slate-600 mb-4">
              Silakan klik tombol di bawah ini untuk membuka Telegram dan secara otomatis menghubungkan akun Anda.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              {deepLink && (
                <a 
                  href={deepLink} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex-1"
                >
                  <Button className="w-full bg-sky-500 hover:bg-sky-600">
                    <Send className="w-4 h-4 mr-2" />
                    Buka Telegram
                  </Button>
                </a>
              )}
              <Button 
                variant="outline" 
                onClick={() => setToken(null)}
                className="sm:w-auto"
              >
                Tutup
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
