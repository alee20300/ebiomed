-- Realistic medium-hospital demo seed for eBiomed.
-- Demo users:
--   admin@ebiomed.local / password123
--   supervisor@ebiomed.local / password123
--   tech1@ebiomed.local / password123
--   tech2@ebiomed.local / password123
--   store@ebiomed.local / password123
--   nurse@ebiomed.local / password123

create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

set search_path = ebiomed, public, extensions;

truncate table
  ebiomed.profiles,
  ebiomed.sites,
  ebiomed.departments,
  ebiomed.equipment,
  ebiomed.parts,
  ebiomed.vendors
restart identity cascade;

do $$
declare
  u record;
  v_user_id uuid;
begin
  for u in
    select * from (values
      ('admin@ebiomed.local', 'Admin User', 'admin', 'Biomedical Engineering', '+971-50-100-0001'),
      ('supervisor@ebiomed.local', 'Dr. Sara Al Mansoori', 'admin', 'Biomedical Engineering', '+971-50-100-0002'),
      ('tech1@ebiomed.local', 'Ahmed Khan', 'technician', 'Biomedical Engineering', '+971-50-100-0003'),
      ('tech2@ebiomed.local', 'Mariam Hassan', 'technician', 'Biomedical Engineering', '+971-50-100-0004'),
      ('store@ebiomed.local', 'Omar Nasser', 'technician', 'Central Store', '+971-50-100-0005'),
      ('nurse@ebiomed.local', 'Noura Saeed', 'viewer', 'ICU', '+971-50-100-0006')
    ) as users(email, full_name, role, department, phone)
  loop
    select id into v_user_id from auth.users where email = u.email;

    if v_user_id is null then
      v_user_id := gen_random_uuid();

      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) values (
        '00000000-0000-0000-0000-000000000000',
        v_user_id,
        'authenticated',
        'authenticated',
        u.email,
        extensions.crypt('password123', extensions.gen_salt('bf')),
        now(),
        now(),
        now(),
        '{"provider":"email","providers":["email"]}',
        jsonb_build_object('full_name', u.full_name),
        '',
        '',
        '',
        ''
      );

      insert into auth.identities (
        provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
      ) values (
        v_user_id,
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', u.email),
        'email',
        now(),
        now(),
        now()
      ) on conflict do nothing;
    end if;

    insert into ebiomed.profiles (id, full_name, role, department, phone)
    values (v_user_id, u.full_name, u.role::ebiomed.user_role, u.department, u.phone)
    on conflict (id) do update set
      full_name = excluded.full_name,
      role = excluded.role,
      department = excluded.department,
      phone = excluded.phone,
      updated_at = now();
  end loop;
end $$;

insert into ebiomed.sites (name, code) values
  ('Main Hospital', 'MAIN'),
  ('Rehabilitation Center', 'REHAB'),
  ('Central Store', 'STORE')
on conflict (code) do update set name = excluded.name, updated_at = now();

insert into ebiomed.departments (name, site_id)
select d.name, s.id
from (values
  ('Biomedical Engineering', 'MAIN'),
  ('ICU', 'MAIN'),
  ('Emergency Department', 'MAIN'),
  ('Operating Room', 'MAIN'),
  ('NICU', 'MAIN'),
  ('Radiology', 'MAIN'),
  ('Laboratory', 'MAIN'),
  ('Dialysis Unit', 'MAIN'),
  ('Cardiology', 'MAIN'),
  ('Endoscopy', 'MAIN'),
  ('Maternity', 'MAIN'),
  ('Ward 2A', 'MAIN'),
  ('Ward 3B', 'MAIN'),
  ('Outpatient Clinic', 'MAIN'),
  ('Central Store', 'STORE'),
  ('Rehabilitation', 'REHAB')
) as d(name, site_code)
join ebiomed.sites s on s.code = d.site_code
on conflict (name) do update set site_id = excluded.site_id, updated_at = now();

insert into ebiomed.buildings (site_id, name, code)
select s.id, b.name, b.code
from (values
  ('MAIN', 'Main Clinical Tower', 'MCT'),
  ('MAIN', 'Diagnostic and Treatment Block', 'DTB'),
  ('STORE', 'Central Stores Warehouse', 'CSW'),
  ('REHAB', 'Rehabilitation Building', 'RHB')
) as b(site_code, name, code)
join ebiomed.sites s on s.code = b.site_code
on conflict (site_id, name) do update set code = excluded.code, updated_at = now();

insert into ebiomed.floors (building_id, name)
select b.id, f.name
from (values
  ('MCT', 'Ground Floor'), ('MCT', 'First Floor'), ('MCT', 'Second Floor'), ('MCT', 'Third Floor'),
  ('DTB', 'Ground Floor'), ('DTB', 'First Floor'),
  ('CSW', 'Ground Floor'),
  ('RHB', 'Ground Floor')
) as f(building_code, name)
join ebiomed.buildings b on b.code = f.building_code
on conflict (building_id, name) do nothing;

insert into ebiomed.rooms (floor_id, name, department_id)
select f.id, r.room_name, d.id
from (values
  ('Main Clinical Tower', 'Ground Floor', 'ER Bay 1', 'Emergency Department'),
  ('Main Clinical Tower', 'Ground Floor', 'ER Bay 5', 'Emergency Department'),
  ('Main Clinical Tower', 'First Floor', 'ICU Bed 04', 'ICU'),
  ('Main Clinical Tower', 'First Floor', 'ICU Bed 09', 'ICU'),
  ('Main Clinical Tower', 'First Floor', 'NICU Pod A', 'NICU'),
  ('Main Clinical Tower', 'Second Floor', 'Ward 2A Store', 'Ward 2A'),
  ('Main Clinical Tower', 'Third Floor', 'Ward 3B', 'Ward 3B'),
  ('Diagnostic and Treatment Block', 'Ground Floor', 'OR Suite 2', 'Operating Room'),
  ('Diagnostic and Treatment Block', 'Ground Floor', 'OR Suite 5', 'Operating Room'),
  ('Diagnostic and Treatment Block', 'First Floor', 'CT Room', 'Radiology'),
  ('Diagnostic and Treatment Block', 'First Floor', 'Ultrasound Room', 'Radiology'),
  ('Diagnostic and Treatment Block', 'First Floor', 'Chemistry Lab', 'Laboratory'),
  ('Central Stores Warehouse', 'Ground Floor', 'Biomedical Cage A', 'Central Store')
) as r(building_name, floor_name, room_name, dept_name)
join ebiomed.buildings b on b.name = r.building_name
join ebiomed.floors f on f.building_id = b.id and f.name = r.floor_name
join ebiomed.departments d on d.name = r.dept_name
on conflict (floor_id, name) do update set department_id = excluded.department_id, updated_at = now();

insert into ebiomed.vendors (name, contact_name, email, phone, address, notes) values
  ('Gulf Medical Systems', 'Rashid Patel', 'service@gulfmedical.example', '+971-4-555-0101', 'Dubai Healthcare City', 'Primary service partner for monitoring and ICU equipment'),
  ('Al Noor Biomedical Supplies', 'Huda Khalil', 'orders@alnoorbiomed.example', '+971-2-555-0102', 'Abu Dhabi Industrial Area', 'Consumables and common spare parts'),
  ('MedTech Imaging ME', 'Joseph Haddad', 'support@medtechimaging.example', '+971-4-555-0103', 'Dubai Silicon Oasis', 'Radiology equipment service and parts'),
  ('LifeSupport Services LLC', 'Priya Menon', 'dispatch@lifesupport.example', '+971-6-555-0104', 'Sharjah', 'Ventilator, anesthesia, and defibrillator support'),
  ('LabCare Diagnostics', 'Fatima Qureshi', 'service@labcare.example', '+971-4-555-0105', 'Jebel Ali', 'Laboratory analyzers and reagent service')
on conflict (name) do update set
  contact_name = excluded.contact_name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  notes = excluded.notes,
  deleted_at = null,
  updated_at = now();

insert into ebiomed.stock_locations (code, name, site, building, floor, room) values
  ('BIO-CAGE-A', 'Biomedical Cage A', 'Central Store', 'Central Stores Warehouse', 'Ground Floor', 'Biomedical Cage A'),
  ('ICU-SAT', 'ICU Satellite Store', 'Main Hospital', 'Main Clinical Tower', 'First Floor', 'ICU Store'),
  ('OR-SAT', 'OR Satellite Store', 'Main Hospital', 'Diagnostic and Treatment Block', 'Ground Floor', 'OR Clean Utility'),
  ('RAD-SAT', 'Radiology Satellite Store', 'Main Hospital', 'Diagnostic and Treatment Block', 'First Floor', 'Radiology Store')
on conflict (code) do update set
  name = excluded.name,
  site = excluded.site,
  building = excluded.building,
  floor = excluded.floor,
  room = excluded.room,
  active = true,
  updated_at = now();

insert into ebiomed.parts (
  name, part_number, quantity_on_hand, min_threshold, max_threshold, reorder_quantity,
  unit_cost, supplier, location, preferred_vendor_id, vendor_price, lead_time_days,
  stock_location, bin_code, valuation_method
)
select p.name, p.part_number, p.qty, p.min_qty, p.max_qty, p.reorder_qty,
  p.unit_cost, v.name, p.stock_location, v.id, p.vendor_price, p.lead_days,
  p.stock_location, p.bin_code, p.valuation::ebiomed.inventory_valuation_method
from (values
  ('ECG Electrodes Pack', 'CON-ECG-001', 180, 80, 350, 120, 12.50, 'Al Noor Biomedical Supplies', 11.75, 4, 'Biomedical Cage A', 'A-01', 'fifo'),
  ('SpO2 Adult Probe', 'MAS-SPO2-AD', 5, 12, 35, 18, 68.00, 'Al Noor Biomedical Supplies', 62.50, 6, 'Biomedical Cage A', 'A-02', 'weighted_average'),
  ('SpO2 Neonatal Wrap Sensor', 'MAS-SPO2-NEO', 8, 10, 30, 12, 74.00, 'Al Noor Biomedical Supplies', 69.00, 8, 'ICU Satellite Store', 'ICU-01', 'weighted_average'),
  ('Infusion Pump Giving Set', 'BAX-IP-SET', 320, 150, 600, 250, 3.40, 'Al Noor Biomedical Supplies', 3.10, 3, 'Biomedical Cage A', 'A-03', 'fifo'),
  ('Syringe Pump Plunger Clamp', 'BAX-SP-CLAMP', 4, 6, 18, 8, 95.00, 'Gulf Medical Systems', 88.00, 10, 'Biomedical Cage A', 'B-01', 'standard_cost'),
  ('Ventilator Expiratory Filter', 'DRA-VF-500', 26, 18, 80, 35, 23.00, 'LifeSupport Services LLC', 21.50, 5, 'ICU Satellite Store', 'ICU-02', 'fifo'),
  ('Ventilator Flow Sensor', 'DRA-FS-840', 3, 6, 18, 8, 145.00, 'LifeSupport Services LLC', 136.00, 12, 'ICU Satellite Store', 'ICU-03', 'weighted_average'),
  ('Defibrillator Adult Pads', 'STR-DPAD-AD', 22, 18, 70, 35, 45.00, 'LifeSupport Services LLC', 42.00, 4, 'ER Satellite Store', 'ER-01', 'fifo'),
  ('Defibrillator Battery Pack', 'STR-BAT-LP15', 2, 3, 8, 4, 390.00, 'LifeSupport Services LLC', 365.00, 14, 'Biomedical Cage A', 'B-02', 'standard_cost'),
  ('NIBP Hose Adult', 'PHI-NIBP-HOSE', 14, 10, 30, 15, 38.00, 'Gulf Medical Systems', 34.00, 6, 'Biomedical Cage A', 'A-04', 'weighted_average'),
  ('ECG Lead Wire Set', 'GE-ECG-LD10', 10, 10, 35, 16, 58.00, 'Gulf Medical Systems', 54.00, 7, 'Biomedical Cage A', 'A-05', 'weighted_average'),
  ('Patient Monitor Battery', 'PHI-PM-BAT', 6, 8, 20, 10, 210.00, 'Gulf Medical Systems', 195.00, 9, 'Biomedical Cage A', 'B-03', 'standard_cost'),
  ('Ultrasound Probe Cover Pack', 'US-COVER-100', 96, 60, 250, 120, 18.00, 'Al Noor Biomedical Supplies', 16.50, 3, 'Radiology Satellite Store', 'RAD-01', 'fifo'),
  ('CT Injector Syringe Kit', 'CT-INJ-KIT', 18, 25, 80, 40, 41.00, 'MedTech Imaging ME', 38.00, 7, 'Radiology Satellite Store', 'RAD-02', 'fifo'),
  ('Dialysis Bloodline Set', 'FRE-BL-5008', 75, 60, 220, 100, 11.00, 'Al Noor Biomedical Supplies', 10.20, 5, 'Biomedical Cage A', 'C-01', 'fifo'),
  ('Dialysis Conductivity Cell', 'FRE-COND-CELL', 1, 2, 6, 3, 480.00, 'Gulf Medical Systems', 455.00, 21, 'Biomedical Cage A', 'C-02', 'standard_cost'),
  ('Analyzer Sample Probe', 'LAB-SP-01', 2, 3, 9, 4, 320.00, 'LabCare Diagnostics', 300.00, 12, 'Biomedical Cage A', 'D-01', 'standard_cost'),
  ('Centrifuge Rotor Gasket', 'LAB-CEN-GSK', 9, 4, 16, 6, 28.00, 'LabCare Diagnostics', 25.00, 6, 'Biomedical Cage A', 'D-02', 'weighted_average'),
  ('Anesthesia Soda Lime Canister', 'AN-SL-CAN', 42, 25, 100, 50, 16.00, 'LifeSupport Services LLC', 14.75, 4, 'OR Satellite Store', 'OR-01', 'fifo'),
  ('Anesthesia Oxygen Cell', 'AN-O2-CELL', 3, 4, 12, 6, 165.00, 'LifeSupport Services LLC', 154.00, 10, 'OR Satellite Store', 'OR-02', 'standard_cost')
) as p(name, part_number, qty, min_qty, max_qty, reorder_qty, unit_cost, vendor_name, vendor_price, lead_days, stock_location, bin_code, valuation)
join ebiomed.vendors v on v.name = p.vendor_name;

insert into ebiomed.part_stock_balances (
  part_id, stock_location_id, bin_code, quantity_on_hand, min_threshold, max_threshold, reorder_quantity, unit_cost
)
select p.id, sl.id, p.bin_code, p.quantity_on_hand, p.min_threshold, p.max_threshold, p.reorder_quantity, p.unit_cost
from ebiomed.parts p
join ebiomed.stock_locations sl on sl.name = coalesce(p.stock_location, 'Biomedical Cage A')
on conflict do nothing;

insert into ebiomed.vendor_part_pricing (vendor_id, part_id, unit_price, lead_time_days, stock_location, is_preferred)
select preferred_vendor_id, id, coalesce(vendor_price, unit_cost), coalesce(lead_time_days, 7), stock_location, true
from ebiomed.parts
where preferred_vendor_id is not null
on conflict (vendor_id, part_id) do update set
  unit_price = excluded.unit_price,
  lead_time_days = excluded.lead_time_days,
  stock_location = excluded.stock_location,
  is_preferred = true,
  updated_at = now();

with equipment_seed as (
  select * from (values
    ('BM-ICU-001','VN-500-24001','Ventilator V500','V500','Drager','ICU','ICU Bed 04','active','Ventilator','Life support','life_support','class_iii','owned','ICU-100','Adult ICU','DRA-V500','5.4.1','2.1.0',true,'192.168.10.21','AA:BB:CC:10:00:01','2023-01-15'::date,'2027-01-15'::date,365,12450,640,5,5,5,5,3),
    ('BM-ICU-002','VN-500-24002','Ventilator V500','V500','Drager','ICU','ICU Bed 09','under_repair','Ventilator','Life support','life_support','class_iii','owned','ICU-100','Adult ICU','DRA-V500','5.4.1','2.1.0',true,'192.168.10.22','AA:BB:CC:10:00:02','2023-02-11'::date,'2027-02-11'::date,365,13880,710,5,5,5,5,4),
    ('BM-ICU-003','PB-980-23018','Ventilator PB980','PB980','Medtronic','ICU','ICU Bed 12','active','Ventilator','Life support','life_support','class_iii','owned','ICU-100','Adult ICU','MDT-PB980','4.2.0','1.8.2',true,'192.168.10.23','AA:BB:CC:10:00:03','2022-06-01'::date,'2026-06-01'::date,365,10220,590,5,5,5,5,3),
    ('BM-ICU-004','PM-INT-0087','Patient Monitor IntelliVue MX450','MX450','Philips','ICU','ICU Bed 04','active','Monitor','Patient monitoring','high','class_ii','owned','ICU-100','Adult ICU','PHI-MX450','4.8.2','3.0.1',true,'192.168.10.31','AA:BB:CC:10:00:04','2022-09-17'::date,'2025-09-17'::date,365,18400,880,4,4,5,4,3),
    ('BM-ICU-005','PM-INT-0088','Patient Monitor IntelliVue MX450','MX450','Philips','ICU','ICU Bed 09','active','Monitor','Patient monitoring','high','class_ii','owned','ICU-100','Adult ICU','PHI-MX450','4.8.2','3.0.1',true,'192.168.10.32','AA:BB:CC:10:00:05','2022-09-17'::date,'2025-09-17'::date,365,17650,840,4,4,5,4,3),
    ('BM-ICU-006','IP-8100-5001','Infusion Pump Module','8100','Baxter','ICU','ICU Bed 04','active','Infusion Pump','Medication delivery','high','class_ii','owned','ICU-100','Adult ICU','BAX-8100','3.2.0','1.9.4',false,null,null,'2023-08-10'::date,'2026-08-10'::date,180,5220,120,4,4,5,4,2),
    ('BM-ICU-007','IP-8100-5002','Infusion Pump Module','8100','Baxter','ICU','ICU Bed 09','active','Infusion Pump','Medication delivery','high','class_ii','owned','ICU-100','Adult ICU','BAX-8100','3.2.0','1.9.4',false,null,null,'2023-08-10'::date,'2026-08-10'::date,180,4980,115,4,4,5,4,2),
    ('BM-ICU-008','SYR-3500-071','Syringe Pump','Perfusor Space','B. Braun','ICU','ICU Store','active','Syringe Pump','Medication delivery','high','class_ii','owned','ICU-100','Adult ICU','BBR-SPACE','2.7.1','1.2.0',false,null,null,'2024-01-09'::date,'2027-01-09'::date,180,2180,380,4,3,5,4,2),
    ('BM-ER-001','LP15-23101','Defibrillator LIFEPAK 15','LIFEPAK 15','Stryker','Emergency Department','ER Bay 1','active','Defibrillator','Life support','life_support','class_iii','owned','ER-300','Emergency','STR-LP15','2.7.0','1.4.2',false,null,null,'2022-03-05'::date,'2026-03-05'::date,180,11600,420,5,5,5,5,2),
    ('BM-ER-002','LP15-23102','Defibrillator LIFEPAK 15','LIFEPAK 15','Stryker','Emergency Department','Resuscitation Room','active','Defibrillator','Life support','life_support','class_iii','owned','ER-300','Emergency','STR-LP15','2.7.0','1.4.2',false,null,null,'2022-03-05'::date,'2026-03-05'::date,180,11120,400,5,5,5,5,2),
    ('BM-ER-003','PM-800-4421','Patient Monitor PM-800','PM-800','Mindray','Emergency Department','ER Bay 5','out_of_tolerance','Monitor','Patient monitoring','high','class_ii','owned','ER-300','Emergency','MIN-PM800','3.1.5','2.0.0',true,'192.168.20.35','AA:BB:CC:20:00:03','2021-11-20'::date,'2025-11-20'::date,365,9000,1190,4,4,5,4,4),
    ('BM-ER-004','ECG-12L-3001','12 Lead ECG Machine','MAC 2000','GE Healthcare','Emergency Department','ER Procedure Room','active','Diagnostic','Diagnostic','medium','class_ii','owned','ER-300','Emergency','GE-MAC2000','3.5.9','2.3.4',true,'192.168.20.44','AA:BB:CC:20:00:04','2023-04-02'::date,'2026-04-02'::date,365,4300,870,3,3,4,3,3),
    ('BM-OR-001','AN-A7-1701','Anesthesia Machine A7','A7','Mindray','Operating Room','OR Suite 2','active','Anesthesia','Life support','life_support','class_iii','leased','OR-400','Operating Room','MIN-A7','6.1.0','2.6.3',true,'192.168.30.42','AA:BB:CC:30:00:01','2023-02-01'::date,'2027-02-01'::date,180,8230,440,5,5,5,5,4),
    ('BM-OR-002','AN-A7-1702','Anesthesia Machine A7','A7','Mindray','Operating Room','OR Suite 5','active','Anesthesia','Life support','life_support','class_iii','leased','OR-400','Operating Room','MIN-A7','6.1.0','2.6.3',true,'192.168.30.43','AA:BB:CC:30:00:02','2023-02-01'::date,'2027-02-01'::date,180,7980,430,5,5,5,5,4),
    ('BM-OR-003','ESU-300-8201','Electrosurgical Unit','ForceTriad','Medtronic','Operating Room','OR Suite 2','active','Surgical','Therapy','high','class_ii','owned','OR-400','Operating Room','MDT-FT','2.5.0','1.5.2',false,null,null,'2021-07-14'::date,'2025-07-14'::date,365,3600,210,4,4,4,4,3),
    ('BM-OR-004','ORL-LED-541','Surgical Light System','TruLight 5000','Hillrom','Operating Room','OR Suite 5','active','Surgical Light','Procedure support','medium','class_i','owned','OR-400','Operating Room','HIL-TL5000',null,null,false,null,null,'2020-03-18'::date,'2024-03-18'::date,365,1320,80,3,4,3,2,3),
    ('BM-NICU-001','INC-GI-1401','Infant Incubator','Giraffe OmniBed','GE Healthcare','NICU','NICU Pod A','active','Incubator','Neonatal care','life_support','class_ii','owned','NICU-110','NICU','GE-GIRAFFE','1.9.2','1.0.8',false,null,null,'2022-10-12'::date,'2026-10-12'::date,180,9200,310,5,5,5,4,3),
    ('BM-NICU-002','PHOT-LED-091','Phototherapy Unit','neoBLUE','Natus','NICU','NICU Pod A','active','Phototherapy','Therapy','medium','class_ii','owned','NICU-110','NICU','NAT-NEOBLUE','1.1.0','1.0.1',false,null,null,'2023-12-01'::date,'2026-12-01'::date,365,680,95,3,2,4,3,2),
    ('BM-RAD-001','CT-REV-8701','CT Scanner Revolution EVO','Revolution EVO','GE Healthcare','Radiology','CT Room','active','Imaging','Imaging','high','class_ii','owned','RAD-600','Radiology','GE-REV-EVO','8.3.1','4.5.0',true,'192.168.40.18','AA:BB:CC:40:00:01','2021-05-20'::date,'2026-05-20'::date,365,6120,1840,4,5,5,4,5),
    ('BM-RAD-002','US-EPIQ-2307','Ultrasound EPIQ 7','EPIQ 7','Philips','Radiology','Ultrasound Room','active','Imaging','Imaging','medium','class_ii','owned','RAD-600','Radiology','PHI-EPIQ7','7.2.4','3.8.1',true,'192.168.40.22','AA:BB:CC:40:00:02','2022-11-01'::date,'2026-11-01'::date,365,4450,620,3,3,5,3,3),
    ('BM-RAD-003','XR-PORT-1001','Portable X-Ray','Optima XR220','GE Healthcare','Radiology','Radiology Dept','active','Imaging','Imaging','medium','class_ii','owned','RAD-600','Radiology','GE-XR220','8.3.1','4.5.0',true,'192.168.40.28','AA:BB:CC:40:00:03','2023-04-20'::date,'2027-04-20'::date,365,2860,390,3,4,4,4,3),
    ('BM-LAB-001','CHEM-5800-01','Chemistry Analyzer','AU5800','Beckman Coulter','Laboratory','Chemistry Lab','active','Laboratory Analyzer','Diagnostic','high','class_ii','owned','LAB-800','Laboratory','BEC-AU5800','6.0.2','2.1.7',true,'192.168.60.11','AA:BB:CC:60:00:01','2021-08-08'::date,'2025-08-08'::date,365,8420,1560,4,4,5,4,4),
    ('BM-LAB-002','CBC-XN-5501','Hematology Analyzer','XN-550','Sysmex','Laboratory','Hematology Lab','active','Laboratory Analyzer','Diagnostic','high','class_ii','owned','LAB-800','Laboratory','SYS-XN550','3.8.0','1.7.4',true,'192.168.60.12','AA:BB:CC:60:00:02','2022-01-14'::date,'2026-01-14'::date,365,6900,980,4,4,5,4,3),
    ('BM-LAB-003','CENT-5810-33','Bench Centrifuge','5810R','Eppendorf','Laboratory','Sample Processing','active','Laboratory','Diagnostic','medium','class_i','owned','LAB-800','Laboratory','EPP-5810R',null,null,false,null,null,'2020-09-02'::date,'2024-09-02'::date,365,1180,160,2,2,4,2,3),
    ('BM-DIAL-001','FRE-5008-441','Dialysis Machine 5008S','5008S','Fresenius','Dialysis Unit','Dialysis Bay 8','active','Dialysis','Therapy','high','class_ii','owned','NEPH-500','Dialysis','FRE-5008S','4.0.5','2.2.8',false,null,null,'2022-09-15'::date,'2026-09-15'::date,180,7140,820,4,5,5,4,3),
    ('BM-DIAL-002','FRE-5008-442','Dialysis Machine 5008S','5008S','Fresenius','Dialysis Unit','Dialysis Bay 9','under_repair','Dialysis','Therapy','high','class_ii','owned','NEPH-500','Dialysis','FRE-5008S','4.0.5','2.2.8',false,null,null,'2022-09-15'::date,'2026-09-15'::date,180,6980,810,4,5,5,4,4),
    ('BM-CARD-001','ECHO-E95-110','Echocardiography System','Vivid E95','GE Healthcare','Cardiology','Echo Room 1','active','Ultrasound','Diagnostic','medium','class_ii','owned','CARD-700','Cardiology','GE-E95','7.0.1','3.3.0',true,'192.168.50.16','AA:BB:CC:50:00:01','2021-04-11'::date,'2025-04-11'::date,365,3880,540,3,3,4,3,3),
    ('BM-CARD-002','TMT-CASE-88','Stress Test System','CASE','GE Healthcare','Cardiology','Stress Lab','active','Diagnostic','Diagnostic','medium','class_ii','owned','CARD-700','Cardiology','GE-CASE','2.3.1','1.2.4',true,'192.168.50.19','AA:BB:CC:50:00:02','2020-10-02'::date,'2024-10-02'::date,365,2240,330,3,3,4,3,4),
    ('BM-W2A-001','BED-MON-2101','Vital Signs Monitor','Connex Spot','Welch Allyn','Ward 2A','Ward 2A Nurse Station','active','Monitor','Patient monitoring','medium','class_ii','owned','W2A-210','Ward 2A','WEL-CONNEX','1.7.0','1.0.3',true,'192.168.70.21','AA:BB:CC:70:00:01','2023-05-12'::date,'2026-05-12'::date,365,1340,210,3,3,4,3,2),
    ('BM-W2A-002','PUMP-ALR-8701','Infusion Pump Alaris','Alaris GP','BD','Ward 2A','Ward 2A Store','active','Infusion Pump','Medication delivery','medium','class_ii','owned','W2A-210','Ward 2A','BD-ALARIS','2.2.5','1.1.1',false,null,null,'2023-07-10'::date,'2026-07-10'::date,180,4820,260,3,3,5,3,2),
    ('BM-W3B-001','PO-200-9001','Pulse Oximeter','Rad-97','Masimo','Ward 3B','Ward 3B','under_repair','Monitor','Patient monitoring','medium','class_ii','owned','W3B-310','Ward 3B','MAS-RAD97','1.8.0','1.1.6',false,null,null,'2021-05-10'::date,'2025-05-10'::date,365,1860,220,3,3,4,3,3),
    ('BM-W3B-002','BP-CAS-4051','Non-invasive BP Monitor','CAS 740','CAS Medical','Ward 3B','Ward 3B','active','Monitor','Patient monitoring','low','class_i','owned','W3B-310','Ward 3B','CAS-740',null,null,false,null,null,'2020-02-01'::date,'2024-02-01'::date,365,720,85,2,2,3,2,3),
    ('BM-OPD-001','NEB-OMP-101','Nebulizer Compressor','CompAir','Omron','Outpatient Clinic','Treatment Room','active','Therapy','Respiratory therapy','low','class_i','owned','OPD-900','OPD','OMR-COMPAIR',null,null,false,null,null,'2022-12-04'::date,'2025-12-04'::date,365,430,35,2,2,3,2,2),
    ('BM-ENDO-001','ENDO-190-772','Video Endoscopy Processor','EVIS EXERA III','Olympus','Endoscopy','Endoscopy Room 1','active','Endoscopy','Diagnostic','high','class_ii','owned','ENDO-850','Endoscopy','OLY-190','4.5.0','2.8.0',true,'192.168.80.11','AA:BB:CC:80:00:01','2021-12-12'::date,'2025-12-12'::date,365,2560,460,4,4,4,4,3)
  ) as e(tag_number, serial_number, name, model, manufacturer, department, location, status, category, device_category, asset_criticality, risk_class, ownership_type, cost_center, clinical_area, manufacturer_device_id, software_version, firmware_version, network_connected, ip_address, mac_address, install_date, warranty_expiry, calibration_interval_days, run_hours, cycle_count, patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden)
)
insert into ebiomed.equipment (
  tag_number, serial_number, name, model, manufacturer, department, location, status, category,
  device_category, asset_criticality, risk_class, ownership_type, cost_center, clinical_area,
  manufacturer_device_id, software_version, firmware_version, network_connected, ip_address, mac_address,
  install_date, warranty_expiry, commissioned_at, acceptance_test_date, acquisition_date,
  purchase_cost, expected_life_years, residual_value, current_value, depreciation_method,
  calibration_interval_days, last_calibrated, next_calibration_due, run_hours, cycle_count,
  pm_trigger_type, pm_trigger_value, patient_impact, downtime_impact, utilization, regulatory_class,
  maintenance_burden, lifecycle_stage, lifecycle_risk_score, lifecycle_risk_band,
  service_cost_to_date, downtime_minutes_to_date, replacement_due_date,
  patch_status, antivirus_status, backup_status, os_platform, network_zone
)
select
  tag_number, serial_number, name, model, manufacturer, department, location, status::ebiomed.equipment_status, category,
  device_category, asset_criticality, risk_class, ownership_type, cost_center, clinical_area,
  manufacturer_device_id, software_version, firmware_version, network_connected, ip_address::inet, mac_address,
  install_date, warranty_expiry, install_date + interval '5 days', install_date + interval '3 days', install_date,
  case asset_criticality when 'life_support' then 85000 when 'high' then 52000 when 'medium' then 23000 else 4500 end,
  case asset_criticality when 'life_support' then 8 when 'high' then 7 when 'medium' then 6 else 5 end,
  500,
  case asset_criticality when 'life_support' then 61000 when 'high' then 36000 when 'medium' then 14500 else 2400 end,
  'straight_line',
  calibration_interval_days,
  now() - ((calibration_interval_days / 2)::text || ' days')::interval,
  now() + ((calibration_interval_days / 3)::text || ' days')::interval,
  run_hours,
  cycle_count,
  case when category in ('Infusion Pump','Syringe Pump','Dialysis') then 'calendar_or_usage'::ebiomed.pm_trigger_type else 'calendar'::ebiomed.pm_trigger_type end,
  case when category in ('Infusion Pump','Syringe Pump') then 750 when category = 'Dialysis' then 1000 else null end,
  patient_impact, downtime_impact, utilization, regulatory_class, maintenance_burden,
  case when warranty_expiry < current_date then 'limited_support' else 'in_service' end,
  (patient_impact * 4 + downtime_impact * 4 + utilization * 3 + regulatory_class * 5 + maintenance_burden * 4),
  case when (patient_impact * 4 + downtime_impact * 4 + utilization * 3 + regulatory_class * 5 + maintenance_burden * 4) >= 85 then 'Critical'
       when (patient_impact * 4 + downtime_impact * 4 + utilization * 3 + regulatory_class * 5 + maintenance_burden * 4) >= 70 then 'High'
       when (patient_impact * 4 + downtime_impact * 4 + utilization * 3 + regulatory_class * 5 + maintenance_burden * 4) >= 45 then 'Moderate'
       else 'Low' end,
  round((run_hours * 0.9 + cycle_count * 1.6)::numeric, 2),
  case when status in ('under_repair','out_of_tolerance') then 360 else 0 end,
  install_date + interval '7 years',
  case when network_connected then 'due' else 'unknown' end,
  case when network_connected then 'enabled' else 'not_applicable' end,
  case when network_connected then 'current' else 'not_applicable' end,
  case when network_connected then 'Windows 10 IoT' else null end,
  case when network_connected then 'clinical-devices' else null end
from equipment_seed;

insert into ebiomed.pm_schedules (
  equipment_id, frequency_days, trigger_type, calendar_interval_days, meter_interval, cycle_interval,
  risk_modifier, grace_period_days, description, checklist, last_completed, next_due, assigned_to, active
)
select
  e.id,
  case e.asset_criticality when 'life_support' then 90 when 'high' then 120 when 'medium' then 180 else 365 end,
  e.pm_trigger_type,
  case e.asset_criticality when 'life_support' then 90 when 'high' then 120 when 'medium' then 180 else 365 end,
  case when e.pm_trigger_type in ('run_hours','calendar_or_usage','calendar_and_usage') then e.pm_trigger_value else null end,
  case when e.pm_trigger_type = 'cycles' then e.pm_trigger_value::integer else null end,
  case e.asset_criticality when 'life_support' then 1.25 when 'high' then 1.10 else 1.00 end,
  case e.asset_criticality when 'life_support' then 0 when 'high' then 1 else 3 end,
  case e.category
    when 'Ventilator' then 'Ventilator safety check, performance verification, filter path inspection'
    when 'Infusion Pump' then 'Infusion accuracy, alarm, battery, and occlusion verification'
    when 'Defibrillator' then 'Energy delivery, battery, pads connector, and safety verification'
    when 'Imaging' then 'Image quality, safety interlock, detector, and workstation checks'
    else 'Preventive maintenance inspection and operational safety check'
  end,
  jsonb_build_array(
    jsonb_build_object('id','visual','text','Visual inspection and labeling','completed',false,'required',true),
    jsonb_build_object('id','power','text','Power cord, battery, and protective earth check','completed',false,'required',true),
    jsonb_build_object('id','function','text','Run manufacturer functional self-test','completed',false,'required',true),
    jsonb_build_object('id','clean','text','Clean exterior, filters, vents, probes, and accessories','completed',false,'required',false),
    jsonb_build_object('id','record','text','Record measurements, parts, and next due date','completed',false,'required',true)
  ),
  now() - (case e.asset_criticality when 'life_support' then interval '92 days' when 'high' then interval '80 days' when 'medium' then interval '140 days' else interval '260 days' end),
  now() + (
    case
      when e.tag_number in ('BM-ICU-002','BM-ER-001','BM-OR-001','BM-RAD-001') then interval '-4 days'
      when e.tag_number in ('BM-ICU-001','BM-NICU-001','BM-DIAL-001','BM-LAB-001') then interval '1 day'
      when e.asset_criticality = 'life_support' then interval '6 days'
      when e.asset_criticality = 'high' then interval '18 days'
      when e.asset_criticality = 'medium' then interval '42 days'
      else interval '95 days'
    end
  ),
  (select id from ebiomed.profiles where email_match.full_name is not null limit 1),
  true
from ebiomed.equipment e
cross join lateral (select 'x'::text as full_name) email_match;

update ebiomed.pm_schedules ps
set assigned_to = p.id
from ebiomed.profiles p
where p.full_name = case
  when (select department from ebiomed.equipment where id = ps.equipment_id) in ('ICU','NICU','Operating Room') then 'Ahmed Khan'
  else 'Mariam Hassan'
end;

insert into ebiomed.pm_occurrences (
  pm_schedule_id, equipment_id, due_at, trigger_type, due_meter, due_cycle, status, escalation_level, generated_at
)
select
  ps.id,
  ps.equipment_id,
  ps.next_due,
  ps.trigger_type,
  case when ps.meter_interval is not null then e.run_hours + ps.meter_interval else null end,
  case when ps.cycle_interval is not null then e.cycle_count + ps.cycle_interval else null end,
  case when ps.next_due < now() then 'due'::ebiomed.pm_occurrence_status else 'due'::ebiomed.pm_occurrence_status end,
  case when ps.next_due < now() then 'admin'::ebiomed.pm_escalation_level else 'none'::ebiomed.pm_escalation_level end,
  case when ps.next_due < now() then now() - interval '2 days' else null end
from ebiomed.pm_schedules ps
join ebiomed.equipment e on e.id = ps.equipment_id
where ps.next_due <= now() + interval '30 days';

insert into ebiomed.checklist_templates (equipment_id, name, frequency, items, active)
select id, category || ' daily readiness checklist', 'daily',
  jsonb_build_array(
    jsonb_build_object('id','asset','text','Asset tag and location verified','type','checkbox','required',true),
    jsonb_build_object('id','power','text','Power-on/self-test completed','type','checkbox','required',true),
    jsonb_build_object('id','accessories','text','Required accessories available','type','checkbox','required',true),
    jsonb_build_object('id','clean','text','Clean and ready for patient use','type','checkbox','required',true)
  ),
  true
from ebiomed.equipment
where asset_criticality in ('life_support','high')
limit 18;

do $$
declare
  admin_id uuid := (select id from ebiomed.profiles where full_name = 'Admin User');
  supervisor_id uuid := (select id from ebiomed.profiles where full_name = 'Dr. Sara Al Mansoori');
  tech1_id uuid := (select id from ebiomed.profiles where full_name = 'Ahmed Khan');
  tech2_id uuid := (select id from ebiomed.profiles where full_name = 'Mariam Hassan');
  store_id uuid := (select id from ebiomed.profiles where full_name = 'Omar Nasser');
  wo_id uuid;
  jc_id uuid;
begin
  insert into ebiomed.work_orders (equipment_id, type, priority, status, description, failure_mode, patient_safety_impact, assigned_to, created_by, created_at, started_at, reported_by_name, reported_by_department, downtime_minutes)
  select e.id, 'corrective', 'critical', 'in_progress', 'Ventilator displays high-pressure alarm during pre-use check; ICU bed unavailable until resolved.', 'Airway pressure alarm / flow path restriction', 'high', tech1_id, supervisor_id, now() - interval '5 hours', now() - interval '4 hours', 'Noura Saeed', 'ICU', 300
  from ebiomed.equipment e where e.tag_number = 'BM-ICU-002'
  returning id into wo_id;

  insert into ebiomed.wo_comments (work_order_id, author_id, text, created_at)
  values (wo_id, tech1_id, 'Removed expiratory cassette and found condensation in flow sensor path. Flow sensor replacement requested.', now() - interval '3 hours');

  insert into ebiomed.job_cards (work_order_id, technician_id, status, started_at, summary)
  values (wo_id, tech1_id, 'in_progress', now() - interval '4 hours', 'Troubleshooting active; awaiting flow sensor from ICU satellite store')
  returning id into jc_id;
  insert into ebiomed.job_card_entries (job_card_id, description, started_at, ended_at, duration_minutes)
  values (jc_id, 'Initial inspection, alarm history review, breathing circuit leak test', now() - interval '4 hours', now() - interval '3 hours 10 minutes', 50);

  insert into ebiomed.work_orders (equipment_id, type, priority, status, description, failure_mode, patient_safety_impact, assigned_to, created_by, created_at, started_at, reported_by_name, reported_by_department, downtime_minutes)
  select e.id, 'corrective', 'high', 'open', 'Patient monitor NIBP readings fail calibration check and cannot be used for triage vitals.', 'NIBP calibration drift', 'medium', tech2_id, supervisor_id, now() - interval '1 day', null, 'Fatima Ahmed', 'Emergency Department', 1440
  from ebiomed.equipment e where e.tag_number = 'BM-ER-003';

  insert into ebiomed.work_orders (equipment_id, type, priority, status, description, failure_mode, patient_safety_impact, assigned_to, created_by, created_at, started_at, reported_by_name, reported_by_department, downtime_minutes)
  select e.id, 'corrective', 'high', 'on_hold', 'Dialysis machine fails conductivity stabilization during startup; replacement conductivity cell required.', 'Conductivity cell failure', 'medium', tech2_id, supervisor_id, now() - interval '2 days', now() - interval '2 days', 'Dialysis Charge Nurse', 'Dialysis Unit', 2880
  from ebiomed.equipment e where e.tag_number = 'BM-DIAL-002';

  insert into ebiomed.work_orders (equipment_id, type, priority, status, description, failure_mode, patient_safety_impact, assigned_to, created_by, created_at, started_at, completed_at, root_cause, service_outcome, resolution_notes, downtime_minutes)
  select e.id, 'corrective', 'medium', 'completed', 'Pulse oximeter intermittent probe detection fault.', 'Accessory detection fault', 'low', tech1_id, supervisor_id, now() - interval '6 days', now() - interval '6 days', now() - interval '5 days 20 hours', 'Damaged reusable SpO2 probe cable', 'replaced', 'Replaced probe and verified readings against reference simulator.', 240
  from ebiomed.equipment e where e.tag_number = 'BM-W3B-001';

  insert into ebiomed.work_orders (equipment_id, type, priority, status, description, failure_mode, patient_safety_impact, assigned_to, created_by, created_at, started_at, completed_at, root_cause, service_outcome, resolution_notes, downtime_minutes)
  select e.id, 'preventive', 'medium', 'completed', 'Scheduled preventive maintenance completed.', 'Scheduled PM', 'none', tech2_id, supervisor_id, now() - interval '8 days', now() - interval '8 days', now() - interval '8 days' + interval '2 hours', 'Scheduled maintenance', 'repaired', 'PM completed, electrical safety and functional checks passed.', 0
  from ebiomed.equipment e where e.tag_number in ('BM-RAD-002','BM-LAB-002','BM-W2A-001')
  limit 3;

  insert into ebiomed.complaints (
    equipment_id, reference_number, description, reported_by_name, reported_by_department, requester_email,
    status, request_status, clinical_impact, patient_safety_risk, urgency, patient_care_critical,
    called_department, answered_by, call_status, sla_due_at, sla_response_due_at, sla_resolution_due_at,
    triage_notes, triaged_by, triaged_at, reviewer_id, review_notes, approved_at, created_at
  )
  select e.id, 'REQ-2026-0145', 'Infusion pump channel intermittently stops infusion and alarms occlusion with no visible kink.', 'Noura Saeed', 'ICU', 'noura.saeed@hospital.example',
    'pending_review', 'new', 'patient_at_risk', 'high', 'urgent', true,
    true, 'Ahmed Khan', 'informed', now() + interval '8 hours', now() + interval '30 minutes', now() + interval '8 hours',
    null, null, null, null, null, null, now() - interval '35 minutes'
  from ebiomed.equipment e where e.tag_number = 'BM-ICU-006';

  insert into ebiomed.complaints (
    equipment_id, reference_number, description, reported_by_name, reported_by_department, requester_email,
    status, request_status, clinical_impact, patient_safety_risk, urgency, patient_care_critical,
    called_department, answered_by, call_status, sla_due_at, sla_response_due_at, sla_resolution_due_at,
    triage_notes, triaged_by, triaged_at, reviewer_id, review_notes, approved_at, created_at
  )
  select e.id, 'REQ-2026-0146', 'CT injector syringe stock is below daily case demand and may delay evening scan list.', 'Radiology Coordinator', 'Radiology', 'radiology@hospital.example',
    'approved', 'approved', 'care_delayed', 'medium', 'urgent', false,
    true, 'Omar Nasser', 'informed', now() + interval '12 hours', now() - interval '1 hour', now() + interval '12 hours',
    'Approved for store action and purchase request review.', supervisor_id, now() - interval '2 hours', supervisor_id, 'Proceed with urgent replenishment.', now() - interval '1 hour', now() - interval '3 hours'
  from ebiomed.equipment e where e.tag_number = 'BM-RAD-001';

  insert into ebiomed.complaints (
    equipment_id, reference_number, description, reported_by_name, reported_by_department, requester_email,
    status, request_status, clinical_impact, patient_safety_risk, urgency, patient_care_critical,
    called_department, call_status, sla_due_at, created_at
  )
  select e.id, 'REQ-2026-0147', 'Vital signs monitor rolling stand wheel lock broken.', 'Ward Clerk', 'Ward 2A', 'ward2a@hospital.example',
    'pending_review', 'new', 'routine', 'low', 'normal', false,
    false, 'not_called', now() + interval '48 hours', now() - interval '7 hours'
  from ebiomed.equipment e where e.tag_number = 'BM-W2A-001';

  insert into ebiomed.request_notifications (complaint_id, reference_number, recipient_email, event, message, created_by, delivery_channel, delivery_status, delivery_attempts, delivered_at)
  select id, reference_number, requester_email, 'submitted', 'Your biomedical service request has been received.', supervisor_id, 'email', 'sent', 1, created_at + interval '2 minutes'
  from ebiomed.complaints;

  insert into ebiomed.purchase_requests (
    request_number, part_id, vendor_id, requested_quantity, estimated_unit_cost, needed_by, status,
    source, reason, requested_by, approved_by, approved_at, approval_level, approval_threshold_exceeded
  )
  select 'PR-2026-0038', p.id, p.preferred_vendor_id, 8, p.vendor_price, current_date + 7, 'pending_approval',
    'reorder_suggestion', 'Flow sensors below minimum and one ICU ventilator is waiting for replacement.', store_id, null, null, 'department_head', true
  from ebiomed.parts p where p.part_number = 'DRA-FS-840';

  insert into ebiomed.purchase_requests (
    request_number, part_id, vendor_id, requested_quantity, estimated_unit_cost, needed_by, status,
    source, reason, requested_by, approved_by, approved_at, approval_level, approval_threshold_exceeded
  )
  select 'PR-2026-0039', p.id, p.preferred_vendor_id, 40, p.vendor_price, current_date + 5, 'approved',
    'manual', 'CT injector syringes are below reorder level before a full radiology schedule.', store_id, supervisor_id, now() - interval '1 day', 'standard', false
  from ebiomed.parts p where p.part_number = 'CT-INJ-KIT';
end $$;

insert into ebiomed.purchase_orders (po_number, vendor_id, purchase_request_id, status, ordered_by, ordered_at, expected_delivery, total_amount, notes)
select 'PO-2026-0021', pr.vendor_id, pr.id, 'issued', pr.requested_by, now() - interval '1 day', current_date + 4,
  pr.requested_quantity * coalesce(pr.estimated_unit_cost, 0),
  'Urgent replenishment for radiology injector consumables'
from ebiomed.purchase_requests pr
where pr.request_number = 'PR-2026-0039'
on conflict (po_number) do nothing;

insert into ebiomed.purchase_order_lines (purchase_order_id, part_id, quantity_ordered, quantity_received, unit_cost, stock_location)
select po.id, pr.part_id, pr.requested_quantity, 0, coalesce(pr.estimated_unit_cost, 0), 'RAD-SAT'
from ebiomed.purchase_orders po
join ebiomed.purchase_requests pr on pr.id = po.purchase_request_id
where po.po_number = 'PO-2026-0021';

insert into ebiomed.contracts (vendor_id, contract_number, contract_type, title, start_date, end_date, alert_days_before_expiry, annual_cost, sla_response_hours, status, notes)
select v.id, c.contract_number, c.contract_type::ebiomed.contract_type, c.title, c.start_date, c.end_date, c.alert_days, c.annual_cost, c.sla_hours, c.status::ebiomed.contract_status, c.notes
from (values
  ('LifeSupport Services LLC', 'CMC-2026-VENT-001', 'CMC', 'Ventilator and anesthesia comprehensive maintenance', current_date - 220, current_date + 18, 45, 145000, 4, 'expiring', 'Renewal under finance review; includes 24/7 life-support response'),
  ('MedTech Imaging ME', 'AMC-2025-RAD-004', 'AMC', 'Radiology imaging annual maintenance', current_date - 300, current_date + 95, 30, 98000, 8, 'active', 'Includes CT, portable X-ray, ultrasound, and workstation support'),
  ('LabCare Diagnostics', 'CMC-2025-LAB-002', 'CMC', 'Laboratory analyzer service agreement', current_date - 260, current_date + 160, 30, 76000, 12, 'active', 'Includes quarterly PM and emergency callout')
) as c(vendor_name, contract_number, contract_type, title, start_date, end_date, alert_days, annual_cost, sla_hours, status, notes)
join ebiomed.vendors v on v.name = c.vendor_name
on conflict (contract_number) do nothing;

insert into ebiomed.contract_assets (contract_id, equipment_id, coverage_notes)
select c.id, e.id, 'Covered under ' || c.contract_number
from ebiomed.contracts c
join ebiomed.equipment e on
  (c.contract_number = 'CMC-2026-VENT-001' and e.category in ('Ventilator','Anesthesia','Defibrillator'))
  or (c.contract_number = 'AMC-2025-RAD-004' and e.department = 'Radiology')
  or (c.contract_number = 'CMC-2025-LAB-002' and e.department = 'Laboratory')
on conflict (contract_id, equipment_id) do nothing;

select set_config('request.jwt.claim.sub', (select id::text from ebiomed.profiles where full_name = 'Admin User'), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

alter table ebiomed.reference_standards disable trigger trg_reference_standards_audit;

insert into ebiomed.reference_standards (serial_number, name, manufacturer, model, certificate_number, certificate_expiry, calibration_interval_days, location, notes, status)
values
  ('REF-SIM-001', 'Multi-parameter Patient Simulator', 'Fluke Biomedical', 'ProSim 8', 'CAL-REF-2026-001', current_date + 240, 365, 'Biomedical Workshop', 'Used for monitor and ECG verification', 'active'),
  ('REF-ESA-002', 'Electrical Safety Analyzer', 'Fluke Biomedical', 'ESA620', 'CAL-REF-2026-002', current_date + 180, 365, 'Biomedical Workshop', 'Primary electrical safety analyzer', 'active'),
  ('REF-PUMP-003', 'Infusion Device Analyzer', 'Rigel Medical', 'Multi-Flo', 'CAL-REF-2026-003', current_date + 45, 365, 'Biomedical Workshop', 'Due for renewal soon', 'active'),
  ('REF-PRESS-004', 'Pressure Meter', 'Druck', 'DPI 705E', 'CAL-REF-2025-009', current_date - 10, 365, 'Biomedical Workshop', 'Expired; do not use until recalibrated', 'expired')
on conflict (serial_number) do update set
  certificate_expiry = excluded.certificate_expiry,
  status = excluded.status,
  updated_at = now();

alter table ebiomed.reference_standards enable trigger trg_reference_standards_audit;

insert into ebiomed.calibration_readings (
  equipment_id, reference_standard_id, parameter, measured_value, expected_value, tolerance_min, tolerance_max,
  unit, passed, notes, recorded_by, recorded_at
)
select e.id, rs.id, reading.parameter, reading.measured, reading.expected, reading.minv, reading.maxv, reading.unit, reading.passed, reading.notes,
  (select id from ebiomed.profiles where full_name = 'Mariam Hassan'),
  now() - interval '12 days'
from ebiomed.equipment e
join ebiomed.reference_standards rs on rs.serial_number = 'REF-SIM-001'
cross join (values
  ('Heart rate', 80, 80, 78, 82, 'bpm', true, 'Within tolerance'),
  ('SpO2 simulation', 97, 97, 95, 99, '%', true, 'Within tolerance')
) as reading(parameter, measured, expected, minv, maxv, unit, passed, notes)
where e.tag_number in ('BM-ICU-004','BM-ICU-005','BM-W2A-001');

insert into ebiomed.certificates (equipment_id, certificate_number, audit_trail_hash, issued_by, issued_at, valid_until, status)
select e.id, 'CERT-2026-' || right(e.tag_number, 3), encode(digest(e.id::text || e.tag_number || now()::text, 'sha256'), 'hex'),
  (select id from ebiomed.profiles where full_name = 'Dr. Sara Al Mansoori'),
  now() - interval '12 days',
  now() + interval '353 days',
  'valid'
from ebiomed.equipment e
where e.tag_number in ('BM-ICU-004','BM-ICU-005','BM-W2A-001')
on conflict (certificate_number) do nothing;

insert into ebiomed.inventory_transactions (
  part_id, stock_location_id, bin_code, transaction_type, quantity_delta, unit_cost, reference, reason, recorded_by, recorded_at
)
select p.id, sl.id, p.bin_code, 'receipt', p.quantity_on_hand, p.unit_cost, 'OPENING-BALANCE-2026', 'Medium hospital demo opening balance',
  (select id from ebiomed.profiles where full_name = 'Omar Nasser'), now() - interval '14 days'
from ebiomed.parts p
join ebiomed.stock_locations sl on sl.name = coalesce(p.stock_location, 'Biomedical Cage A');

insert into ebiomed.viewer_departments (viewer_id, department_id)
select p.id, d.id
from ebiomed.profiles p
join ebiomed.departments d on d.name in ('ICU','Emergency Department')
where p.full_name = 'Noura Saeed'
on conflict do nothing;

update ebiomed.profiles p
set department_id = d.id,
    site_id = s.id
from ebiomed.departments d
join ebiomed.sites s on s.code = case when d.name = 'Central Store' then 'STORE' else 'MAIN' end
where p.department = d.name;

-- Seed spare-part compatibility at the narrowest safe scope. The same part may
-- have more than one model/category rule without duplicating inventory stock.
insert into ebiomed.spare_part_compatibility_rules (
  part_id, scope_type, manufacturer, model, device_category,
  relationship_type, recommended_quantity, notes
)
select
  p.id,
  rule.scope_type,
  rule.manufacturer,
  rule.model,
  rule.device_category,
  rule.relationship_type,
  rule.recommended_quantity,
  rule.notes
from (values
  ('DRA-VF-500',   'model', 'Drager',          'V500',           null,                 'recommended', 18,  'Routine expiratory filter stock for V500 ventilators'),
  ('DRA-FS-840',   'model', 'Drager',          'V500',           null,                 'critical',     6,  'Critical flow-sensing spare for V500 ventilators'),
  ('STR-BAT-LP15', 'model', 'Stryker',         'LIFEPAK 15',     null,                 'critical',     3,  'LIFEPAK 15 replacement battery'),
  ('STR-DPAD-AD',  'model', 'Stryker',         'LIFEPAK 15',     null,                 'recommended', 18,  'Adult defibrillation pads'),
  ('AN-O2-CELL',   'model', 'Mindray',         'A7',             null,                 'critical',     4,  'A7 oxygen-cell replacement'),
  ('AN-SL-CAN',    'model', 'Mindray',         'A7',             null,                 'recommended', 25,  'A7 soda-lime canister stock'),
  ('BAX-IP-SET',   'model', 'Baxter',          '8100',           null,                 'recommended', 150, 'Baxter 8100 giving sets'),
  ('BAX-SP-CLAMP', 'model', 'B. Braun',        'Perfusor Space', null,                 'critical',     6,  'Perfusor Space plunger-clamp spare'),
  ('FRE-BL-5008',  'model', 'Fresenius',       '5008S',          null,                 'recommended', 60,  '5008S dialysis bloodline consumable'),
  ('FRE-COND-CELL','model', 'Fresenius',       '5008S',          null,                 'critical',     2,  '5008S conductivity-cell spare'),
  ('CT-INJ-KIT',   'model', 'GE Healthcare',   'Revolution EVO', null,                 'recommended', 25,  'CT injector syringe kit'),
  ('GE-ECG-LD10',  'model', 'GE Healthcare',   'MAC 2000',       null,                 'recommended', 10,  'MAC 2000 lead-wire set'),
  ('CON-ECG-001',  'model', 'GE Healthcare',   'MAC 2000',       null,                 'recommended', 80,  'ECG electrode consumable for diagnostic ECG'),
  ('CON-ECG-001',  'category', null,           null,             'Patient monitoring', 'compatible',  80,  'Shared ECG electrode consumable for patient monitors'),
  ('LAB-CEN-GSK',  'model', 'Eppendorf',       '5810R',          null,                 'recommended', 4,  '5810R rotor gasket'),
  ('LAB-SP-01',    'model', 'Beckman Coulter', 'AU5800',         null,                 'critical',     3,  'AU5800 sample probe'),
  ('MAS-SPO2-AD',  'model', 'Masimo',          'Rad-97',         null,                 'recommended', 12,  'Adult SpO2 probe'),
  ('MAS-SPO2-NEO', 'model', 'Masimo',          'Rad-97',         null,                 'recommended', 10,  'Neonatal SpO2 wrap sensor'),
  ('PHI-NIBP-HOSE','model', 'Philips',         'MX450',          null,                 'recommended', 10,  'MX450 adult NIBP hose'),
  ('PHI-PM-BAT',   'model', 'Philips',         'MX450',          null,                 'critical',     8,  'MX450 replacement battery'),
  ('US-COVER-100', 'model', 'Philips',         'EPIQ 7',         null,                 'recommended', 60,  'Ultrasound probe covers'),
  ('US-COVER-100', 'model', 'GE Healthcare',   'Vivid E95',      null,                 'recommended', 60,  'Ultrasound probe covers')
) as rule(part_number, scope_type, manufacturer, model, device_category, relationship_type, recommended_quantity, notes)
join ebiomed.parts p on p.part_number = rule.part_number
on conflict do nothing;
