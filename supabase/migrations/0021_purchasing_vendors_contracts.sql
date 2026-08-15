-- Phase 5: Purchasing, vendors, contracts, and inventory receiving

create type ebiomed.purchase_request_status as enum ('pending_approval', 'approved', 'rejected', 'converted', 'cancelled');
create type ebiomed.purchase_order_status as enum ('draft', 'issued', 'partially_received', 'received', 'cancelled');
create type ebiomed.contract_type as enum ('AMC', 'CMC');
create type ebiomed.contract_status as enum ('active', 'expiring', 'expired', 'cancelled');
create type ebiomed.vendor_performance_event_type as enum ('response', 'sla', 'cost', 'repeat_failure');

create table ebiomed.vendors (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table ebiomed.parts
  add column preferred_vendor_id uuid references ebiomed.vendors(id),
  add column vendor_price decimal(10,2),
  add column lead_time_days integer,
  add column stock_location text;

update ebiomed.parts
set stock_location = location
where stock_location is null and location is not null;

alter table ebiomed.parts
  add constraint parts_vendor_price_non_negative CHECK (vendor_price IS NULL OR vendor_price >= 0) NOT VALID,
  add constraint parts_lead_time_non_negative CHECK (lead_time_days IS NULL OR lead_time_days >= 0) NOT VALID;

create table ebiomed.vendor_part_pricing (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references ebiomed.vendors(id) on delete cascade,
  part_id uuid not null references ebiomed.parts(id) on delete cascade,
  unit_price decimal(10,2) not null check (unit_price >= 0),
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  stock_location text,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vendor_id, part_id)
);

create table ebiomed.purchase_requests (
  id uuid primary key default uuid_generate_v4(),
  request_number text not null unique default ('PR-' || upper(substr(uuid_generate_v4()::text, 1, 8))),
  part_id uuid not null references ebiomed.parts(id) on delete restrict,
  vendor_id uuid references ebiomed.vendors(id) on delete restrict,
  requested_quantity integer not null check (requested_quantity > 0),
  estimated_unit_cost decimal(10,2) check (estimated_unit_cost IS NULL OR estimated_unit_cost >= 0),
  needed_by date,
  status ebiomed.purchase_request_status not null default 'pending_approval',
  source text not null default 'manual',
  reason text not null,
  requested_by uuid not null references ebiomed.profiles(id),
  approved_by uuid references ebiomed.profiles(id),
  approved_at timestamptz,
  rejected_by uuid references ebiomed.profiles(id),
  rejected_at timestamptz,
  rejection_reason text,
  purchase_order_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ebiomed.purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null unique default ('PO-' || upper(substr(uuid_generate_v4()::text, 1, 8))),
  vendor_id uuid not null references ebiomed.vendors(id) on delete restrict,
  purchase_request_id uuid references ebiomed.purchase_requests(id) on delete set null,
  status ebiomed.purchase_order_status not null default 'issued',
  ordered_by uuid not null references ebiomed.profiles(id),
  ordered_at timestamptz not null default now(),
  expected_delivery date,
  total_amount decimal(12,2) not null default 0 check (total_amount >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ebiomed.purchase_requests
  add constraint purchase_requests_purchase_order_id_fkey
  foreign key (purchase_order_id) references ebiomed.purchase_orders(id) on delete set null;

create table ebiomed.purchase_order_lines (
  id uuid primary key default uuid_generate_v4(),
  purchase_order_id uuid not null references ebiomed.purchase_orders(id) on delete cascade,
  part_id uuid not null references ebiomed.parts(id) on delete restrict,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0 check (quantity_received >= 0),
  unit_cost decimal(10,2) not null check (unit_cost >= 0),
  stock_location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint po_lines_received_not_over_ordered CHECK (quantity_received <= quantity_ordered) NOT VALID
);

create table ebiomed.contracts (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references ebiomed.vendors(id) on delete restrict,
  contract_number text not null unique,
  contract_type ebiomed.contract_type not null,
  title text not null,
  start_date date not null,
  end_date date not null,
  alert_days_before_expiry integer not null default 30 check (alert_days_before_expiry >= 0),
  annual_cost decimal(12,2) check (annual_cost IS NULL OR annual_cost >= 0),
  sla_response_hours integer check (sla_response_hours IS NULL OR sla_response_hours >= 0),
  status ebiomed.contract_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_end_after_start CHECK (end_date >= start_date) NOT VALID
);

create table ebiomed.contract_assets (
  id uuid primary key default uuid_generate_v4(),
  contract_id uuid not null references ebiomed.contracts(id) on delete cascade,
  equipment_id uuid not null references ebiomed.equipment(id) on delete cascade,
  coverage_notes text,
  created_at timestamptz not null default now(),
  unique (contract_id, equipment_id)
);

create table ebiomed.vendor_performance_events (
  id uuid primary key default uuid_generate_v4(),
  vendor_id uuid not null references ebiomed.vendors(id) on delete cascade,
  work_order_id uuid references ebiomed.work_orders(id) on delete set null,
  contract_id uuid references ebiomed.contracts(id) on delete set null,
  event_type ebiomed.vendor_performance_event_type not null,
  response_time_hours numeric(8,2),
  sla_met boolean,
  cost_amount decimal(12,2) check (cost_amount IS NULL OR cost_amount >= 0),
  repeat_failure boolean not null default false,
  notes text,
  recorded_by uuid references ebiomed.profiles(id),
  recorded_at timestamptz not null default now()
);

create index idx_parts_preferred_vendor on ebiomed.parts(preferred_vendor_id);
create index idx_vendor_part_pricing_part on ebiomed.vendor_part_pricing(part_id);
create index idx_purchase_requests_status on ebiomed.purchase_requests(status);
create index idx_purchase_requests_part on ebiomed.purchase_requests(part_id);
create index idx_purchase_orders_status on ebiomed.purchase_orders(status);
create index idx_purchase_order_lines_po on ebiomed.purchase_order_lines(purchase_order_id);
create index idx_contracts_end_date on ebiomed.contracts(end_date);
create index idx_contract_assets_equipment on ebiomed.contract_assets(equipment_id);
create index idx_vendor_performance_vendor on ebiomed.vendor_performance_events(vendor_id);
