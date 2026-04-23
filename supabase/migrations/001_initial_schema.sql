-- ============================================
-- ResikIn — Initial Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Users (Koordinator & Petugas)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(20) NOT NULL CHECK (role IN ('koordinator', 'petugas')),
  kelurahan_id UUID,
  auth_user_id UUID UNIQUE, -- links to Supabase Auth
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. Reports (Laporan Sampah)
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_code VARCHAR(20) UNIQUE NOT NULL,
  reporter_name VARCHAR(255) NOT NULL,
  reporter_phone VARCHAR(20) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN (
    'tidak_terangkut', 'tps_penuh', 'sampah_liar', 'bau', 'lainnya'
  )),
  description TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'dikirim' CHECK (status IN (
    'dikirim', 'diterima', 'ditugaskan', 'dalam_proses', 'selesai', 'ditolak'
  )),
  reject_reason TEXT,
  kelurahan_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Report Photos
-- ============================================
CREATE TABLE report_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  photo_url VARCHAR(500) NOT NULL,
  type VARCHAR(20) NOT NULL DEFAULT 'report' CHECK (type IN ('report', 'completion')),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. Assignments (Penugasan)
-- ============================================
CREATE TABLE assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  petugas_id UUID NOT NULL REFERENCES users(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT
);

-- ============================================
-- 5. Status History (Riwayat Status)
-- ============================================
CREATE TABLE status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  old_status VARCHAR(20),
  new_status VARCHAR(20) NOT NULL,
  changed_by UUID REFERENCES users(id),
  notes TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Schedules (Jadwal Pengangkutan)
-- ============================================
CREATE TABLE schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area VARCHAR(100) NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  vehicle_info VARCHAR(100),
  kelurahan_id UUID,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX idx_reports_tracking_code ON reports(tracking_code);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_category ON reports(category);
CREATE INDEX idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX idx_assignments_petugas ON assignments(petugas_id);
CREATE INDEX idx_assignments_report ON assignments(report_id);
CREATE INDEX idx_status_history_report ON status_history(report_id);
CREATE INDEX idx_report_photos_report ON report_photos(report_id);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- Public can create reports (no auth needed)
CREATE POLICY "Anyone can create reports"
  ON reports FOR INSERT
  WITH CHECK (true);

-- Public can view reports by tracking code
CREATE POLICY "Anyone can view reports by tracking code"
  ON reports FOR SELECT
  USING (true);

-- Public can view report photos
CREATE POLICY "Anyone can view report photos"
  ON report_photos FOR SELECT
  USING (true);

-- Public can add report photos
CREATE POLICY "Anyone can add report photos"
  ON report_photos FOR INSERT
  WITH CHECK (true);

-- Public can view status history
CREATE POLICY "Anyone can view status history"
  ON status_history FOR SELECT
  USING (true);

-- Public can view schedules
CREATE POLICY "Anyone can view schedules"
  ON schedules FOR SELECT
  USING (true);

-- Authenticated users can manage reports
CREATE POLICY "Auth users can update reports"
  ON reports FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Authenticated users can manage assignments
CREATE POLICY "Auth users can manage assignments"
  ON assignments FOR ALL
  USING (auth.role() = 'authenticated');

-- Authenticated users can insert status history
CREATE POLICY "Auth users can insert status history"
  ON status_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Authenticated users can view other users
CREATE POLICY "Auth users can view users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
