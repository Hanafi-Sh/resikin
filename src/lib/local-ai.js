import { pipeline, env } from '@huggingface/transformers';
import path from 'path';

// Konfigurasi: gunakan model lokal yang sudah diunduh, BUKAN dari internet
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = path.join(process.cwd(), 'models');

let classifierInstance = null;
let classifierLoading = null;

/**
 * Mengembalikan instance pipeline zero-shot-image-classification.
 * Menggunakan model CLIP lokal yang sudah di-download ke folder /models.
 */
export async function getClassifier() {
  if (classifierInstance) return classifierInstance;

  // Cegah multiple concurrent downloads
  if (classifierLoading) return classifierLoading;

  console.log('[AI] Memuat model Zero-Shot Image Classification dari disk lokal...');
  console.log('[AI] Path:', path.join(process.cwd(), 'models', 'Xenova', 'clip-vit-base-patch16'));

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
