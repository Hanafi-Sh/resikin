import { pipeline, env } from '@huggingface/transformers';
import path from 'path';
import fs from 'fs';

let classifierInstance = null;
let classifierLoading = null;

export async function getClassifier() {
  if (classifierInstance) return classifierInstance;
  if (classifierLoading) return classifierLoading;

  classifierLoading = (async () => {
    try {
      const isVercel = process.env.VERCEL === '1' || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.NODE_ENV === 'production';

      if (isVercel) {
        const cachePath = path.join('/tmp', '.cache');
        if (!fs.existsSync(cachePath)) {
          fs.mkdirSync(cachePath, { recursive: true });
        }
        env.cacheDir = cachePath;
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        console.log('[AI] Memuat model di Vercel Serverless (dari HuggingFace)...');
      } else {
        env.allowLocalModels = true;
        env.allowRemoteModels = false;
        env.localModelPath = path.join(process.cwd(), 'models');
        console.log('[AI] Memuat model di Localhost (dari disk)...');
      }

      const pipe = await pipeline(
        'zero-shot-image-classification',
        'Xenova/clip-vit-base-patch16',
        { device: 'cpu', dtype: 'q8' }
      );
      return pipe;
    } catch (err) {
      console.error('[AI] Initialization error:', err);
      throw err;
    }
  })();

  try {
    classifierInstance = await classifierLoading;
    return classifierInstance;
  } catch (err) {
    classifierLoading = null;
    throw err;
  }
}
