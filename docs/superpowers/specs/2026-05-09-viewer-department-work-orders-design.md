# Viewer Department Work Orders — Design Spec

**Date:** 2026-05-09
**Status:** Approved

## Summary

Viewers (ward managers, doctors in charge, directors) need to see only open work orders from the departments they supervise. Currently viewers see all work orders — same as admins and technicians. This feature scopes the work orders page per viewer based on their supervised departments.

## Data Model

### New Tables

```sql
CREATE TABLE ebiomed.departments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ebiomed.viewer_departments (
  viewer_id uuid NOT NULL REFERENCES ebiomed.profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES ebiomed.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (viewer_id, department_id)
);
```

### Migration Strategy

A single migration that:
1. Creates both tables
2. Seeds `departments` from distinct non-null values in `equipment.department` and `profiles.department`
3. Does NOT auto-map existing viewers — admins assign departments manually post-migration
4. Adds RLS policies: `departments` viewable by all authenticated, insert/update/delete by admin only; `viewer_departments` viewable by all authenticated, insert/delete by admin only

### Existing Tables

No changes to existing tables. The `department` text field on `equipment` and `profiles` remains as-is for backward compatibility and non-viewer use.

## Server Actions

### Modified `getWorkOrders`

When the current user has role `viewer`:
1. Fetch supervised department IDs via `getViewerDepartmentIds(user.id)`
2. Find equipment IDs in those departments
3. Return only work orders for that equipment with status IN (`open`, `in_progress`, `on_hold`)

Admins and technicians get all work orders (unchanged behavior).

### New `getAllDepartments`

Returns the full departments list. Used by admin UI for dropdowns/multi-selects.

### New `getViewerDepartmentIds`

Returns an array of department UUIDs for a given viewer. Reused by both the work orders query and the profile form.

### New `saveViewerDepartments(viewerId, departmentIds)`

Admin-only. Replaces the viewer's supervised departments in the junction table.

### No Changes To

- `createWorkOrder`, `updateWorkOrderStatus`, `getWorkOrderById` — existing role gating is sufficient
- `getAssignedWorkOrders` — technicians continue seeing their own assigned work orders

## Frontend

### Work Orders Page (`src/app/(app)/work-orders/page.tsx`)

**Viewer view:**
- Page title: "My Departments — Work Orders"
- Subtitle: lists the viewer's supervised department names
- "New Work Order" button hidden
- Table shows only open work orders from equipment in supervised departments

**Admin/Technician view:**
- Unchanged from current behavior

### Settings — Departments Management

New section in `/settings`:
- Admin-only access
- Table listing all departments with a delete action
- Inline "Add Department" form
- Delete warns if equipment still references the department (safety check, not a hard block)

### Profile Edit — Supervised Departments

- On the profile edit form, for viewer profiles, add a multi-select picker for supervised departments
- Populated from `departments` table
- Only visible/editable by admins

## RLS Policies

```sql
-- Departments: admin-only write, all read
CREATE POLICY "Departments viewable by authenticated" ON ebiomed.departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Departments editable by admin" ON ebiomed.departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Viewer departments: admin-only write, all read
CREATE POLICY "Viewer departments viewable by authenticated" ON ebiomed.viewer_departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Viewer departments editable by admin" ON ebiomed.viewer_departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM ebiomed.profiles WHERE id = auth.uid() AND role = 'admin')
  );
```

## Error Handling

- Viewer with no supervised departments: Work Orders page shows empty state with message "No departments assigned. Contact an administrator."
- Admin tries to delete a department still referenced by equipment: warn but allow (department name on equipment becomes orphaned text, which is acceptable given the free-text approach)
- Department name collision on insert: return validation error

## Testing

- Unit test: `getWorkOrders` returns filtered results for viewers, unfiltered for admin/technician
- Unit test: `saveViewerDepartments` correctly replaces assignments
- Integration test: viewer can only see work orders from supervised departments
- Manual: admin assigns departments to viewer, viewer logs in and verifies filtered view
