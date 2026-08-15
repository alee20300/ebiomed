-- Phase 0: Stabilize foundation constraints
-- CHECK constraints are NOT VALID so existing production data is not scanned during deploy,
-- but PostgreSQL still enforces them for new and updated rows.

ALTER TABLE ebiomed.equipment
  ADD CONSTRAINT equipment_run_hours_non_negative CHECK (run_hours >= 0) NOT VALID,
  ADD CONSTRAINT equipment_cycle_count_non_negative CHECK (cycle_count >= 0) NOT VALID,
  ADD CONSTRAINT equipment_pm_trigger_value_positive CHECK (pm_trigger_value IS NULL OR pm_trigger_value > 0) NOT VALID,
  ADD CONSTRAINT equipment_warranty_not_before_install CHECK (
    install_date IS NULL OR warranty_expiry IS NULL OR warranty_expiry >= install_date
  ) NOT VALID;

ALTER TABLE ebiomed.work_orders
  ADD CONSTRAINT work_orders_completed_not_before_started CHECK (
    started_at IS NULL OR completed_at IS NULL OR completed_at >= started_at
  ) NOT VALID,
  ADD CONSTRAINT work_orders_downtime_non_negative CHECK (
    downtime_minutes IS NULL OR downtime_minutes >= 0
  ) NOT VALID;

ALTER TABLE ebiomed.pm_schedules
  ADD CONSTRAINT pm_schedules_frequency_positive CHECK (frequency_days > 0) NOT VALID,
  ADD CONSTRAINT pm_schedules_next_due_not_before_last_completed CHECK (
    last_completed IS NULL OR next_due IS NULL OR next_due >= last_completed
  ) NOT VALID;

ALTER TABLE ebiomed.parts
  ADD CONSTRAINT parts_quantity_on_hand_non_negative CHECK (quantity_on_hand >= 0) NOT VALID,
  ADD CONSTRAINT parts_min_threshold_non_negative CHECK (min_threshold >= 0) NOT VALID,
  ADD CONSTRAINT parts_unit_cost_non_negative CHECK (unit_cost IS NULL OR unit_cost >= 0) NOT VALID;

ALTER TABLE ebiomed.job_card_entries
  ADD CONSTRAINT job_card_entries_ended_after_started CHECK (ended_at > started_at) NOT VALID,
  ADD CONSTRAINT job_card_entries_duration_positive CHECK (duration_minutes > 0) NOT VALID;

ALTER TABLE ebiomed.job_card_expenses
  ADD CONSTRAINT job_card_expenses_amount_non_negative CHECK (amount >= 0) NOT VALID;

ALTER TABLE ebiomed.reference_standards
  ADD CONSTRAINT reference_standards_interval_positive CHECK (calibration_interval_days > 0) NOT VALID;

ALTER TABLE ebiomed.calibration_readings
  ADD CONSTRAINT calibration_readings_tolerance_order CHECK (tolerance_min <= tolerance_max) NOT VALID;

ALTER TABLE ebiomed.environmental_readings
  ADD CONSTRAINT environmental_readings_humidity_range CHECK (
    humidity_percent IS NULL OR (humidity_percent >= 0 AND humidity_percent <= 100)
  ) NOT VALID;

ALTER TABLE ebiomed.certificates
  ADD CONSTRAINT certificates_valid_after_issue CHECK (valid_until > issued_at) NOT VALID;
