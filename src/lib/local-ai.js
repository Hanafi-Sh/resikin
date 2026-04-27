import { pipeline, env } from '@huggingface/transformers';
import path from 'path';

// Periksa apakah berjalan di Vercel atau environment production
const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV;

if (isVercel) {
  // Di Vercel (serverless): koneksi internet sangat cepat, jadi kita download dari HuggingFace 
  // ke folder /tmp (satu-satunya folder writable di Vercel Serverless)
  env.cacheDir = '/tmp/.cache';
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
} else {
  // Di lokal (komputer Mas Hanafi): internet lambat, jadi kita baca dari folder 'models' lokal
  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = path.join(process.cwd(), 'models');
}

let classifierInstance = null;
let classifierLoading = null;

export async function getClassifier() {
  if (classifierInstance) return classifierInstance;
  if (classifierLoading) return classifierLoading;

  if (isVercel) {
    console.log('[AI] Memuat model di Vercel Serverless (dari HuggingFace)...');
  } else {
    console.log('[AI] Memuat model di Localhost (dari disk)...');
  }

  classifierLoading = pipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch16',
    { device: 'cpu', dtype: 'q8' }
  );

  try {
    classifierInstance = await classifierLoading;
    console.log('[AI] ✅ Model berhasil dimuat dari disk lokal!');
    return classifierInstance;
  } catch (err) {
    classifierLoading = null;
    console.error('[AI] ❌ Gagal memuat model:', err.message);
    throw err;
  }
}
