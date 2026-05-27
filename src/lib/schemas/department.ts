import { z } from "zod"

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100, "Name too long"),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export const viewerDepartmentsSchema = z.object({
  viewer_id: z.string().uuid(),
  department_ids: z.array(z.string().uuid()),
  reason: z.string().min(5, "Reason for change is required").max(500, "Reason too long"),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
export type ViewerDepartmentsFormData = z.infer<typeof viewerDepartmentsSchema>
