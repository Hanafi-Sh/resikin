import { pipeline, env } from '@huggingface/transformers';

// Nonaktifkan cache model lokal Vercel (karena read-only selain /tmp)
// Kita biarkan transformers.js menyimpan model di memory atau cache bawaannya
env.cacheDir = '/tmp/.cache';

class ImageClassificationPipeline {
  static task = 'zero-shot-image-classification';
  static model = 'Xenova/clip-vit-base-patch32';
  static instance = null;

  static async getInstance() {
    if (this.instance === null) {
      console.log('Menginisialisasi model AI Lokal (Zero-Shot Image Classification)...');
      // Inisialisasi pipeline. Proses ini akan mengunduh model (~150MB) 
      // pada pemanggilan pertama, dan menggunakan cache pada pemanggilan berikutnya.
      this.instance = pipeline(this.task, this.model);
    }
    return this.instance;
  }
}

export default ImageClassificationPipeline;
