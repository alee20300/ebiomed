CREATE SCHEMA IF NOT EXISTS ebiomed;

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Create role enum
create type ebiomed.user_role as enum ('admin', 'technician', 'viewer');
create type ebiomed.equipment_status as enum ('active', 'inactive', 'retired', 'under_repair');
create type ebiomed.work_order_type as enum ('corrective', 'preventive');
create type ebiomed.work_order_priority as enum ('low', 'medium', 'high', 'critical');
create type ebiomed.work_order_status as enum ('open', 'in_progress', 'on_hold', 'completed', 'cancelled');

-- Profiles table (extends auth.users)
create table ebiomed.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role ebiomed.user_role not null default 'technician',
  department text,
  phone text,
  created_at timestamptz not null default now()
);

-- Equipment table
create table ebiomed.equipment (
  id uuid primary key default uuid_generate_v4(),
  tag_number text not null unique,
  serial_number text,
  name text not null,
  model text,
  manufacturer text,
  department text,
  location text,
  status ebiomed.equipment_status not null default 'active',
  category text,
  install_date date,
  warranty_expiry date,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Work orders table
create table ebiomed.work_orders (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references ebiomed.equipment(id) on delete restrict,
  type ebiomed.work_order_type not null default 'corrective',
  priority ebiomed.work_order_priority not null default 'medium',
  status ebiomed.work_order_status not null default 'open',
  description text not null,
  assigned_to uuid references ebiomed.profiles(id),
  created_by uuid not null references ebiomed.profiles(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  resolution_notes text,
  downtime_minutes integer
);

-- PM schedules table
create table ebiomed.pm_schedules (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references ebiomed.equipment(id) on delete cascade,
  frequency_days integer not null,
  description text,
  checklist jsonb default '[]'::jsonb,
  last_completed timestamptz,
  next_due timestamptz,
  assigned_to uuid references ebiomed.profiles(id),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Parts inventory table
create table ebiomed.parts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  part_number text,
  quantity_on_hand integer not null default 0,
  min_threshold integer not null default 5,
  unit_cost decimal(10,2),
  supplier text,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parts usage junction table
create table ebiomed.parts_usage (
  id uuid primary key default uuid_generate_v4(),
  work_order_id uuid not null references ebiomed.work_orders(id) on delete cascade,
  part_id uuid not null references ebiomed.parts(id) on delete restrict,
  quantity_used integer not null check (quantity_used > 0),
  used_by uuid not null references ebiomed.profiles(id),
  used_at timestamptz not null default now()
);

-- Indexes
create index idx_equipment_status on ebiomed.equipment(status);
create index idx_equipment_department on ebiomed.equipment(department);
create index idx_work_orders_status on ebiomed.work_orders(status);
create index idx_work_orders_equipment on ebiomed.work_orders(equipment_id);
create index idx_work_orders_assigned on ebiomed.work_orders(assigned_to);
create index idx_pm_schedules_next_due on ebiomed.pm_schedules(next_due);
create index idx_pm_schedules_equipment on ebiomed.pm_schedules(equipment_id);
create index idx_parts_usage_wo on ebiomed.parts_usage(work_order_id);
