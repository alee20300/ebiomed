import { z } from "zod"

export const departmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(100, "Name too long"),
})

export const viewerDepartmentsSchema = z.object({
  viewer_id: z.string().uuid(),
  department_ids: z.array(z.string().uuid()),
})

export type DepartmentFormData = z.infer<typeof departmentSchema>
export type ViewerDepartmentsFormData = z.infer<typeof viewerDepartmentsSchema>
