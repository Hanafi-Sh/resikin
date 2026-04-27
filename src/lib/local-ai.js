import { pipeline, env } from '@huggingface/transformers';

// Cache model di /tmp agar Vercel bisa mengaksesnya
env.cacheDir = '/tmp/.cache';
// Pastikan model diunduh dari remote
env.allowRemoteModels = true;
env.allowLocalModels = false;

let classifierInstance = null;
let classifierLoading = null;

/**
 * Mengembalikan instance pipeline zero-shot-image-classification.
 * Menggunakan Singleton pattern + loading lock agar model hanya diunduh sekali.
 */
export async function getClassifier() {
  if (classifierInstance) return classifierInstance;

  // Cegah multiple concurrent downloads
  if (classifierLoading) return classifierLoading;

  console.log('[AI] Menginisialisasi model Zero-Shot Image Classification...');
  console.log('[AI] Model: Xenova/clip-vit-base-patch16 (lebih kecil & cepat)');

  classifierLoading = pipeline(
    'zero-shot-image-classification',
    'Xenova/clip-vit-base-patch16',
    { device: 'cpu' }
  );

  try {
    classifierInstance = await classifierLoading;
    console.log('[AI] Model berhasil dimuat!');
    return classifierInstance;
  } catch (err) {
    classifierLoading = null; // Reset agar bisa retry
    throw err;
  }
}
