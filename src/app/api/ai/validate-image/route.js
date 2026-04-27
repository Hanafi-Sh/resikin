import { NextResponse } from 'next/server';
import { getClassifier } from '@/lib/local-ai';

export const maxDuration = 60; // Lebih lama untuk cold start download model

export async function POST(request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // Mendapatkan instance pipeline (mengunduh model pada cold-start pertama)
    let classifier;
    try {
      classifier = await getClassifier();
    } catch (modelErr) {
      console.error('[AI] Gagal memuat model:', modelErr.message);
      return NextResponse.json({
        error: 'Model AI gagal dimuat. Kemungkinan koneksi internet bermasalah.',
        details: modelErr.message,
      }, { status: 503 });
    }

    // Labels untuk zero-shot classification
    const candidate_labels = [
      'a pile of garbage or trash',
      'trash on the street or sidewalk',
      'overflowing waste bin or dumpster',
      'dirty polluted environment',
      'a selfie photo of a person',
      'clean street or park',
      'a pet cat or dog',
      'food or drink on a table',
      'indoor room or furniture',
    ];

    // Melakukan inferensi menggunakan model lokal
    const output = await classifier(image, candidate_labels);

    // Cek apakah label teratas terkait sampah
    const wasteLabels = [
      'a pile of garbage or trash',
      'trash on the street or sidewalk',
      'overflowing waste bin or dumpster',
      'dirty polluted environment',
    ];

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
    console.error('[AI] Error in validate-image API:', error);
    return NextResponse.json({
      error: 'Failed to process image',
      details: error.message,
    }, { status: 500 });
  }
}
