import { NextResponse } from 'next/server';
import ImageClassificationPipeline from '@/lib/local-ai';

// Konfigurasi untuk Vercel: meningkatkan batas ukuran body (karena kita akan mengirim base64 image)
export const maxDuration = 30; // Detik (lebih lama sedikit karena cold start AI)

export async function POST(request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Mendapatkan instance pipeline (akan mengunduh model pada cold-start pertama)
    const classifier = await ImageClassificationPipeline.getInstance();

    // Labels untuk zero-shot classification
    // Kita menyeimbangkan kategori terkait masalah sampah vs kategori gambar umum
    const candidate_labels = [
      'a pile of garbage',
      'trash on the street',
      'waste bin',
      'dirty environment',
      'a selfie of a person',
      'clean street',
      'a pet or animal',
      'food or drink',
      'indoor room',
    ];

    // Melakukan inferensi menggunakan model lokal
    const output = await classifier(image, candidate_labels);
    
    // Output format: [{ score: 0.9, label: 'a pile of garbage' }, ...]
    // Kita cek apakah label teratas (skor tertinggi) adalah salah satu dari masalah sampah
    const wasteLabels = ['a pile of garbage', 'trash on the street', 'waste bin', 'dirty environment'];
    
    let isWaste = false;
    let highestWasteScore = 0;
    
    // Cek 2 label teratas untuk toleransi
    const top2 = output.slice(0, 2);
    for (const item of top2) {
      if (wasteLabels.includes(item.label)) {
        isWaste = true;
      }
      if (wasteLabels.includes(item.label) && item.score > highestWasteScore) {
        highestWasteScore = item.score;
      }
    }

    return NextResponse.json({
      success: true,
      isWaste,
      confidence: highestWasteScore,
      top_label: output[0].label,
      all_results: output,
    });

  } catch (error) {
    console.error('Error in validate-image API:', error);
    return NextResponse.json({ error: 'Failed to process image' }, { status: 500 });
  }
}
