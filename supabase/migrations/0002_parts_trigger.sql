-- Function to decrement parts on usage insert
create or replace function ebiomed.decrement_part_quantity()
returns trigger as $$
begin
  update ebiomed.parts
  set quantity_on_hand = quantity_on_hand - NEW.quantity_used,
      updated_at = now()
  where id = NEW.part_id;
  return NEW;
end;
$$ language plpgsql;

create trigger trg_parts_usage_decrement
  after insert on ebiomed.parts_usage
  for each row execute function ebiomed.decrement_part_quantity();

-- Function to restore parts on usage delete
create or replace function ebiomed.restore_part_quantity()
returns trigger as $$
begin
  update ebiomed.parts
  set quantity_on_hand = quantity_on_hand + OLD.quantity_used,
      updated_at = now()
  where id = OLD.part_id;
  return OLD;
end;
$$ language plpgsql;

create trigger trg_parts_usage_restore
  after delete on ebiomed.parts_usage
  for each row execute function ebiomed.restore_part_quantity();
