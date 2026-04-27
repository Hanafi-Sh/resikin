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
    // Asumsi: tugas yang report-nya belum 'selesai' dianggap aktif
    const { data: activeAssignments, error: assignError } = await supabase
      .from('assignments')
      .select('petugas_id, reports!inner(status)')
      .neq('reports.status', 'selesai');

    // Hitung beban kerja masing-masing petugas
    const workloadMap = {};
    petugasList.forEach(p => { workloadMap[p.id] = 0; });

    if (activeAssignments) {
      activeAssignments.forEach(a => {
        if (workloadMap[a.petugas_id] !== undefined) {
          workloadMap[a.petugas_id] += 1;
        }
      });
    }

    // 4. Algoritma Rekomendasi Pintar (Heuristik AI Logistik)
    // Cari petugas dengan beban kerja paling rendah
    let bestPetugas = null;
    let minLoad = Infinity;

    petugasList.forEach(p => {
      const load = workloadMap[p.id];
      // Jika beban sama, kita bisa tambah logika acak agar distribusi merata,
      // atau pertimbangkan jarak lokasi (jika koordinat live petugas tersedia).
      if (load < minLoad) {
        minLoad = load;
        bestPetugas = p;
      }
    });

    // 5. Generate reasoning string
    const reason = `Sistem merekomendasikan ${bestPetugas.name} karena memiliki beban kerja terendah saat ini (hanya ${minLoad} tugas aktif), sehingga penanganan laporan "${report.category}" ini bisa lebih cepat.`;

    return NextResponse.json({
      success: true,
      recommended_petugas_id: bestPetugas.id,
      recommended_petugas_name: bestPetugas.name,
      reason: reason
    });

  } catch (error) {
    console.error('Error in recommend-petugas API:', error);
    return NextResponse.json({ error: 'Failed to process recommendation' }, { status: 500 });
  }
}
