import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const body = await request.json();
    const { report_id } = body;

    if (!report_id) {
      return NextResponse.json({ error: 'Report ID is required' }, { status: 400 });
    }

    const supabase = await createClient();

    // 1. Ambil data laporan
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('category, address')
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // 2. Ambil semua petugas
    const { data: petugasList, error: petugasError } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'petugas');

    if (petugasError || !petugasList || petugasList.length === 0) {
      return NextResponse.json({ error: 'No petugas available' }, { status: 404 });
    }

    // 3. Ambil semua assignment aktif untuk menghitung beban kerja (workload)
    const { data: activeAssignments, error: assignError } = await supabase
      .from('assignments')
      .select('petugas_id, reports!inner(status)')
      .neq('reports.status', 'selesai');

    const assignmentsPayload = activeAssignments ? activeAssignments.map(a => ({
      petugas_id: a.petugas_id,
      status: a.reports.status
    })) : [];

    // URL Python AI Microservice
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const endpoint = `${aiServiceUrl}/api/ai/recommend-assignment`;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          report_id: report_id,
          category: report.category,
          petugas_list: petugasList,
          active_assignments: assignmentsPayload
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Service responded with status ${response.status}`);
      }

      const result = await response.json();
      return NextResponse.json(result);

    } catch (fetchError) {
      console.error('[AI] Gagal menghubungi AI Microservice:', fetchError.message);
      // Fallback sederhana jika AI Service down
      return NextResponse.json({
        success: true,
        recommended_petugas_id: petugasList[0].id,
        recommended_petugas_name: petugasList[0].name,
        reason: "Fallback: AI Service sedang offline, menggunakan petugas pertama yang tersedia."
      });
    }

  } catch (error) {
    console.error('Error in recommend-petugas API:', error);
    return NextResponse.json({ error: 'Failed to process recommendation' }, { status: 500 });
  }
}
