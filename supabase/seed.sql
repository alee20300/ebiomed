-- Seed admin user (password: password123)
-- Requires pgcrypto extension (enabled by default in Supabase)
create extension if not exists "pgcrypto" with schema extensions;

DO $$
DECLARE
  _user_id uuid := gen_random_uuid();
BEGIN
  -- Skip if admin already exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@ebiomed.local') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      _user_id,
      'authenticated',
      'authenticated',
      'admin@ebiomed.local',
      extensions.crypt('password123', extensions.gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Admin User"}',
      '',
      '',
      '',
      ''
    );

    INSERT INTO auth.identities (
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      _user_id,
      _user_id,
      jsonb_build_object('sub', _user_id::text, 'email', 'admin@ebiomed.local'),
      'email',
      now(),
      now(),
      now()
    );

    INSERT INTO ebiomed.profiles (id, full_name, role)
    VALUES (_user_id, 'Admin User', 'admin');
  END IF;
END $$;

-- Sample equipment
insert into equipment (tag_number, serial_number, name, model, manufacturer, department, location, status, category, install_date, warranty_expiry) values
('BM-001', 'SN-2024001', 'Ventilator V500', 'V500', 'Drager', 'ICU', 'ICU Room 3', 'active', 'Ventilator', '2024-01-15', '2027-01-15'),
('BM-002', 'SN-2024002', 'Infusion Pump', 'IP-3000', 'Baxter', 'Med-Surg', 'Ward 2A', 'active', 'Infusion Pump', '2024-03-10', '2026-03-10'),
('BM-003', 'SN-2024003', 'Patient Monitor', 'PM-800', 'Philips', 'ER', 'ER Bay 5', 'active', 'Monitor', '2023-06-20', '2026-06-20'),
('BM-004', 'SN-2024004', 'Defibrillator', 'LP-15', 'Stryker', 'ER', 'ER Bay 1', 'active', 'Defibrillator', '2023-01-05', '2026-01-05'),
('BM-005', 'SN-2024005', 'Anesthesia Machine', 'A7', 'Mindray', 'OR', 'OR Suite 2', 'active', 'Anesthesia', '2024-02-01', '2027-02-01'),
('BM-006', 'SN-2024006', 'Dialysis Machine', '5008S', 'Fresenius', 'Nephrology', 'Dialysis Bay 8', 'active', 'Dialysis', '2023-09-15', '2026-09-15'),
('BM-007', 'SN-2024007', 'Portable X-Ray', 'XR-100', 'GE Healthcare', 'Radiology', 'Radiology Dept', 'active', 'Imaging', '2024-04-20', '2027-04-20'),
('BM-008', 'SN-2024008', 'Ultrasound', 'U22', 'Siemens', 'Radiology', 'Ultrasound Room', 'active', 'Imaging', '2023-11-01', '2026-11-01'),
('BM-009', 'SN-2024009', 'Pulse Oximeter', 'PO-200', 'Masimo', 'Med-Surg', 'Ward 3B', 'under_repair', 'Monitor', '2023-05-10', '2025-05-10'),
('BM-010', 'SN-2024010', 'ECG Machine', 'ECG-12L', 'GE Healthcare', 'Cardiology', 'Cardio Lab', 'active', 'Diagnostic', '2024-05-01', '2027-05-01');

-- Sample parts
insert into parts (name, part_number, quantity_on_hand, min_threshold, unit_cost, supplier, location) values
('ECG Electrodes (pack)', 'ELC-001', 45, 20, 12.50, 'MedSupplies Inc', 'Cabinet A-3'),
('Oxygen Sensor', 'O2S-202', 8, 5, 85.00, 'BioParts Direct', 'Cabinet B-1'),
('Infusion Pump Tubing', 'IPT-100', 120, 50, 3.25, 'Baxter Supply', 'Cabinet A-1'),
('Defibrillator Pads', 'DPD-400', 15, 10, 45.00, 'Stryker Parts', 'Cabinet B-2'),
('Ventilator Filter', 'VF-500', 12, 8, 22.00, 'Drager Spares', 'Cabinet A-4'),
('Blood Pressure Cuff', 'BPC-200', 20, 10, 35.00, 'MedSupplies Inc', 'Cabinet C-1'),
('SpO2 Probe', 'SPO2-300', 5, 8, 65.00, 'Masimo Parts', 'Cabinet B-3'),
('ECG Lead Wire Set', 'ECG-L08', 10, 10, 55.00, 'GE Parts', 'Cabinet A-3');

-- Sample PM schedules
insert into pm_schedules (equipment_id, frequency_days, description, checklist, assigned_to, active, next_due) 
select 
  id,
  90,
  'Quarterly inspection and calibration',
  '[{"id":"1","text":"Visual inspection of exterior","completed":false},{"id":"2","text":"Check power cord and connections","completed":false},{"id":"3","text":"Run self-test / calibration cycle","completed":false},{"id":"4","text":"Clean filters and vents","completed":false},{"id":"5","text":"Update maintenance log","completed":false}]'::jsonb,
  null,
  true,
  (now() + (random() * interval '60 days'))::timestamptz
from equipment
where status = 'active';

-- Seed departments from equipment data
INSERT INTO ebiomed.departments (name)
SELECT DISTINCT department FROM ebiomed.equipment WHERE department IS NOT NULL
UNION
SELECT DISTINCT department FROM ebiomed.profiles WHERE department IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Add viewer with departments for demo purposes
DO $$
DECLARE
  v_viewer_id uuid;
  v_icu_id uuid;
  v_radiology_id uuid;
BEGIN
  SELECT id INTO v_viewer_id FROM auth.users WHERE email = 'viewer@ebiomed.local';
  SELECT id INTO v_icu_id FROM ebiomed.departments WHERE name = 'ICU' LIMIT 1;
  SELECT id INTO v_radiology_id FROM ebiomed.departments WHERE name = 'Radiology' LIMIT 1;

  IF v_viewer_id IS NOT NULL AND v_icu_id IS NOT NULL THEN
    INSERT INTO ebiomed.viewer_departments (viewer_id, department_id)
    VALUES (v_viewer_id, v_icu_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_viewer_id IS NOT NULL AND v_radiology_id IS NOT NULL THEN
    INSERT INTO ebiomed.viewer_departments (viewer_id, department_id)
    VALUES (v_viewer_id, v_radiology_id)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
