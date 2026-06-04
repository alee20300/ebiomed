# Graph Report - src/  (2026-05-31)

## Corpus Check
- Corpus is ~36,343 words - fits in a single context window. You may not need a graph.

## Summary
- 575 nodes · 1676 edges · 29 communities (26 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Page Components & Route Handlers|Page Components & Route Handlers]]
- [[_COMMUNITY_List Pages & Listing Actions|List Pages & Listing Actions]]
- [[_COMMUNITY_Forms & Detail Pages|Forms & Detail Pages]]
- [[_COMMUNITY_Dashboard & Alerts|Dashboard & Alerts]]
- [[_COMMUNITY_Equipment & PM CRUD Actions|Equipment & PM CRUD Actions]]
- [[_COMMUNITY_Checklist Module|Checklist Module]]
- [[_COMMUNITY_Calibration & Audit Log|Calibration & Audit Log]]
- [[_COMMUNITY_Toast Notification System|Toast Notification System]]
- [[_COMMUNITY_Avatar & Header UI|Avatar & Header UI]]
- [[_COMMUNITY_Work Order Queries & App Shell|Work Order Queries & App Shell]]
- [[_COMMUNITY_API Routes v1 & Authentication|API Routes v1 & Authentication]]
- [[_COMMUNITY_PM Schedules List & Actions|PM Schedules List & Actions]]
- [[_COMMUNITY_Work Order Schemas & Validation|Work Order Schemas & Validation]]
- [[_COMMUNITY_Department Management|Department Management]]
- [[_COMMUNITY_Signatures & PM Task Completion|Signatures & PM Task Completion]]
- [[_COMMUNITY_Calibration Schemas & Validation|Calibration Schemas & Validation]]
- [[_COMMUNITY_Parts Inventory Schemas & Validation|Parts Inventory Schemas & Validation]]
- [[_COMMUNITY_Comments System|Comments System]]
- [[_COMMUNITY_Sidebar & Navigation|Sidebar & Navigation]]
- [[_COMMUNITY_Profile & Role Schema|Profile & Role Schema]]
- [[_COMMUNITY_Supabase Middleware & Auth Proxy|Supabase Middleware & Auth Proxy]]
- [[_COMMUNITY_Reference Standards|Reference Standards]]
- [[_COMMUNITY_Fault Report System|Fault Report System]]
- [[_COMMUNITY_Root Layout|Root Layout]]
- [[_COMMUNITY_Health Check API|Health Check API]]
- [[_COMMUNITY_Empty State Component|Empty State Component]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 40 edges
2. `logAudit()` - 37 edges
3. `Button()` - 36 edges
4. `getCurrentUser()` - 36 edges
5. `buttonVariants` - 30 edges
6. `createClient()` - 27 edges
7. `Label()` - 23 edges
8. `Input()` - 22 edges
9. `Card()` - 17 edges
10. `CardContent()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `PMSchedulesPage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(app)/pm-schedules/page.tsx → lib/actions/profiles.ts
- `AppLayout()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(app)/layout.tsx → lib/actions/profiles.ts
- `UsersList()` --calls--> `buttonVariants`  [EXTRACTED]
  app/(app)/settings/page.tsx → components/ui/button.tsx
- `DepartmentsList()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(app)/settings/page.tsx → lib/actions/profiles.ts
- `SettingsPage()` --calls--> `getCurrentUser()`  [EXTRACTED]
  app/(app)/settings/page.tsx → lib/actions/profiles.ts

## Communities (29 total, 3 thin omitted)

### Community 0 - "Page Components & Route Handlers"
Cohesion: 0.06
Nodes (42): getExpiringCertificates(), getChecklistSubmissions(), EquipmentCalibrationTab(), Props, EquipmentCertificatesTab(), Props, ChecklistHistory(), Props (+34 more)

### Community 1 - "List Pages & Listing Actions"
Cohesion: 0.1
Nodes (38): getAllTemplates(), getParts(), actionColors, AuditEntry, AuditLogTable(), Props, Props, PartsList() (+30 more)

### Community 2 - "Forms & Detail Pages"
Cohesion: 0.08
Nodes (33): createPMSchedule(), getWorkOrderById(), CalibrationExecution(), Props, Props, WorkOrderDetailPage(), FieldType, getFrequencyLabel() (+25 more)

### Community 3 - "Dashboard & Alerts"
Cohesion: 0.07
Nodes (29): startPMTask(), ActivityFeed(), Props, EquipmentResult, EquipmentSearch(), LowStockAlert(), Props, OverduePMAlert() (+21 more)

### Community 4 - "Equipment & PM CRUD Actions"
Cohesion: 0.07
Nodes (30): createEquipment(), getEquipment(), getEquipmentById(), updateEquipment(), getPMScheduleById(), EquipmentForm(), EquipmentTable(), EquipmentList() (+22 more)

### Community 5 - "Checklist Module"
Cohesion: 0.09
Nodes (24): deleteChecklistTemplate(), getChecklistTemplates(), getEquipmentByTag(), saveChecklistTemplate(), submitChecklist(), ChecklistForm(), ItemResult, Props (+16 more)

### Community 6 - "Calibration & Audit Log"
Cohesion: 0.13
Nodes (20): exportAuditLog(), getAuditLog(), logAudit(), createReferenceStandard(), deleteReferenceStandard(), getCalibrationReadings(), submitCalibrationBatch(), updateEquipmentCalibrationParams() (+12 more)

### Community 7 - "Toast Notification System"
Cohesion: 0.11
Nodes (24): Action, ActionType, actionTypes, addToRemoveQueue(), dispatch(), genId(), listeners, memoryState (+16 more)

### Community 8 - "Avatar & Header UI"
Cohesion: 0.1
Nodes (7): signout(), Avatar(), AvatarFallback(), DropdownMenu(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuTrigger()

### Community 9 - "Work Order Queries & App Shell"
Cohesion: 0.13
Nodes (18): getViewerDepartmentIds(), getViewerDepartments(), getCurrentUser(), createWorkOrder(), getAssignedWorkOrders(), getWorkOrders(), AppLayout(), AppHeader() (+10 more)

### Community 10 - "API Routes v1 & Authentication"
Cohesion: 0.26
Nodes (10): extractApiKey(), verifyApiKey(), GET(), POST(), buildFhirDevice(), GET(), mapStatusToFhir(), createClient() (+2 more)

### Community 11 - "PM Schedules List & Actions"
Cohesion: 0.17
Nodes (10): getPMSchedules(), PMList(), PMSchedulesPage(), PMActions(), PMTable(), FieldType, getFrequencyLabel(), Props (+2 more)

### Community 12 - "Work Order Schemas & Validation"
Cohesion: 0.16
Nodes (12): woPriorityEnum, WorkOrderFormData, workOrderSchema, WorkOrderUpdateData, workOrderUpdateSchema, woStatusEnum, woTypeEnum, priorities (+4 more)

### Community 13 - "Department Management"
Cohesion: 0.2
Nodes (12): addDepartment(), deleteDepartment(), getAllDepartments(), requireAdmin(), saveViewerDepartments(), DepartmentFormData, departmentSchema, ViewerDepartmentsFormData (+4 more)

### Community 14 - "Signatures & PM Task Completion"
Cohesion: 0.21
Nodes (9): completePMTask(), getSignatures(), recordSignature(), verifyPassword(), updateWorkOrderStatus(), ChecklistItem, checklistItemSchema, PMScheduleFormData (+1 more)

### Community 16 - "Calibration Schemas & Validation"
Cohesion: 0.22
Nodes (9): CalibrationBatchFormData, calibrationBatchSchema, CalibrationReadingFormData, calibrationReadingSchema, environmentalReadingSchema, ReferenceStandardFormData, referenceStandardSchema, result (+1 more)

### Community 17 - "Parts Inventory Schemas & Validation"
Cohesion: 0.31
Nodes (7): PartFormData, partRestockSchema, partSchema, PartsUsageFormData, partsUsageSchema, result, validData

### Community 18 - "Comments System"
Cohesion: 0.33
Nodes (4): addComment(), CommentFormData, commentSchema, WoComment

### Community 19 - "Sidebar & Navigation"
Cohesion: 0.4
Nodes (4): iconMap, Sidebar(), SidebarProps, NAV_ITEMS

### Community 20 - "Profile & Role Schema"
Cohesion: 0.4
Nodes (4): Profile, profileSchema, profileUpdateSchema, roleEnum

### Community 21 - "Supabase Middleware & Auth Proxy"
Cohesion: 0.6
Nodes (3): config, proxy(), updateSession()

### Community 22 - "Reference Standards"
Cohesion: 0.5
Nodes (3): getReferenceStandards(), ReferenceStandardsTable(), ReferenceStandardsContent()

### Community 23 - "Fault Report System"
Cohesion: 0.5
Nodes (3): submitFaultReport(), FaultReportFormData, faultReportSchema

## Knowledge Gaps
- **116 isolated node(s):** `config`, `metadata`, `PageProps`, `PageProps`, `toastVariants` (+111 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `List Pages & Listing Actions` to `Page Components & Route Handlers`, `Forms & Detail Pages`, `Dashboard & Alerts`, `Equipment & PM CRUD Actions`, `Toast Notification System`, `Avatar & Header UI`, `Work Order Queries & App Shell`, `Sheet UI Primitives`, `Sidebar & Navigation`?**
  _High betweenness centrality (0.103) - this node is a cross-community bridge._
- **Why does `createClient()` connect `API Routes v1 & Authentication` to `Page Components & Route Handlers`, `List Pages & Listing Actions`, `Dashboard & Alerts`, `Equipment & PM CRUD Actions`, `Checklist Module`, `Calibration & Audit Log`, `Work Order Queries & App Shell`, `Department Management`, `Signatures & PM Task Completion`, `Comments System`, `Fault Report System`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `getCurrentUser()` connect `Work Order Queries & App Shell` to `Page Components & Route Handlers`, `List Pages & Listing Actions`, `Dashboard & Alerts`, `Equipment & PM CRUD Actions`, `Calibration & Audit Log`, `Avatar & Header UI`, `PM Schedules List & Actions`, `Department Management`, `Signatures & PM Task Completion`, `Comments System`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **What connects `config`, `metadata`, `PageProps` to the rest of the system?**
  _116 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Page Components & Route Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.06 - nodes in this community are weakly interconnected._
- **Should `List Pages & Listing Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Forms & Detail Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._