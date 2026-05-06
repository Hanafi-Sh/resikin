'use client';

import { useState } from 'react';
import { Camera, Loader2, Image as ImageIcon } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function TestModelPage() {
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset state
    setResult(null);
    setError('');
    
    // Preview image
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      setLoading(true);
      const base64Image = await fileToBase64(file);
      
      const startTime = performance.now();
      const res = await fetch('/api/ai/validate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64Image })
      });
      const endTime = performance.now();
      
      const data = await res.json();
      data.executionTimeMs = Math.round(endTime - startTime);
      
      if (res.ok) {
        setResult(data);
      } else {
        setError(data.error || 'Failed to process image');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-card p-6 rounded-2xl shadow-sm border border-border">
          <h1 className="text-2xl font-bold text-foreground mb-2">Secret AI Debugger</h1>
          <p className="text-muted-foreground mb-6">Test the Zero-Shot Image Classification model locally.</p>
          
          <div className="space-y-6">
            {/* Upload Area */}
            <div>
              <label className="w-full h-32 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition bg-background">
                <Camera className="w-8 h-8 text-muted-foreground mb-2" />
                <span className="text-sm text-muted-foreground font-medium">Klik untuk memilih gambar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Layout for Preview and Result */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Image Preview */}
              <div className="bg-muted rounded-xl flex items-center justify-center min-h-[300px] border border-border overflow-hidden relative">
                {imagePreview ? (
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                    <span className="text-sm">No image selected</span>
                  </div>
                )}
                
                {loading && (
                  <div className="absolute inset-0 bg-card/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-300 mb-3" />
                    <span className="text-indigo-800 dark:text-indigo-200 font-medium animate-pulse">Model is analyzing...</span>
                    <span className="text-xs text-muted-foreground mt-1">This might take a few seconds on cold start</span>
                  </div>
                )}
              </div>

              {/* JSON Result Display */}
              <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-[500px]">
                <h3 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider mb-3">Model Output</h3>
                
                {error && (
                  <div className="text-rose-400 text-sm p-3 bg-rose-400/10 rounded-lg">
                    {error}
                  </div>
                )}

                {!loading && !result && !error && (
                  <div className="text-muted-foreground text-sm flex items-center justify-center h-48">
                    Waiting for input...
                  </div>
                )}

                {result && (
                  <div className="space-y-4">
                    {/* Summary Badge */}
                    <div className={`p-3 rounded-lg border ${result.isWaste ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/20 border-rose-500/30 text-rose-300'}`}>
                      <p className="font-semibold">{result.isWaste ? '✅ Detected as WASTE' : '❌ NOT detected as waste (SPAM)'}</p>
                      <p className="text-sm opacity-80 mt-1">Top label: &quot;{result.top_label}&quot; ({(result.confidence * 100).toFixed(2)}%)</p>
                      {result.suggested_category && (
                        <p className="text-sm font-medium mt-1 text-emerald-200">
                          ✨ Suggested Category: <span className="uppercase tracking-wider">{result.suggested_category}</span>
                        </p>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground">Execution Time: {result.executionTimeMs} ms</p>

                    <pre className="text-xs text-sky-300 font-mono whitespace-pre-wrap break-all">
                      {JSON.stringify(result.all_results, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
