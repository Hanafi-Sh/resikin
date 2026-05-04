import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(request) {
  try {
    const body = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    // URL Python AI Microservice (Bisa dikonfigurasi lewat .env di Vercel nanti)
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const endpoint = `${aiServiceUrl}/api/ai/validate-image`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image }),
      });

      if (!response.ok) {
        throw new Error(`AI Service responded with status ${response.status}`);
      }

      const result = await response.json();
      return NextResponse.json(result);

    } catch (fetchError) {
      console.error('[AI] Gagal menghubungi AI Microservice:', fetchError.message);
      return NextResponse.json({
        error: 'Layanan AI sedang tidak tersedia (Microservice Down).',
        details: fetchError.message,
      }, { status: 503 });
    }

  } catch (error) {
    console.error('[AI] Error in validate-image API:', error);
    return NextResponse.json({
      error: 'Failed to process image',
      details: error.message,
    }, { status: 500 });
  }
}
