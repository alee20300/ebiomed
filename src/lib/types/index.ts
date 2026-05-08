export interface Equipment {
  id: string
  tag_number: string
  serial_number: string | null
  name: string
  model: string | null
  manufacturer: string | null
  department: string | null
  location: string | null
  status: "active" | "inactive" | "retired" | "under_repair"
  category: string | null
  install_date: string | null
  warranty_expiry: string | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface WorkOrder {
  id: string
  equipment_id: string
  type: "corrective" | "preventive"
  priority: "low" | "medium" | "high" | "critical"
  status: "open" | "in_progress" | "on_hold" | "completed" | "cancelled"
  description: string
  assigned_to: string | null
  created_by: string
  created_at: string
  started_at: string | null
  completed_at: string | null
  resolution_notes: string | null
  downtime_minutes: number | null
  equipment?: Equipment
  assigned_profile?: Profile | null
  created_profile?: Profile | null
}

export interface PMSchedule {
  id: string
  equipment_id: string
  frequency_days: number
  description: string | null
  checklist: ChecklistItem[]
  last_completed: string | null
  next_due: string | null
  assigned_to: string | null
  active: boolean
  created_at: string
  equipment?: Equipment
}

export interface ChecklistItem {
  id: string
  text: string
  completed: boolean
}

export interface Part {
  id: string
  name: string
  part_number: string | null
  quantity_on_hand: number
  min_threshold: number
  unit_cost: number | null
  supplier: string | null
  location: string | null
  created_at: string
  updated_at: string
}

export interface PartsUsage {
  id: string
  work_order_id: string
  part_id: string
  quantity_used: number
  used_by: string
  used_at: string
  part?: Part
}

export interface Profile {
  id: string
  full_name: string
  role: "admin" | "technician" | "viewer"
  department: string | null
  phone: string | null
  created_at: string
}
