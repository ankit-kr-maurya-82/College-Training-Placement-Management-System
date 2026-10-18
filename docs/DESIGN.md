# Design System and UX Specification

## 1. Design Principles
- **Clarity:** Make the next action and current status obvious.
- **Consistency:** Reuse existing components, spacing, typography, and navigation.
- **Accessibility:** Keyboard support, visible focus, labels, and sufficient contrast.
- **Responsive behavior:** Tables should adapt to small screens without hiding critical actions.
- **Privacy by default:** Show only information required for each role.

## 2. Application Areas
- Student dashboard
- Company/recruiter workspace
- TPO/Admin dashboard
- Shared authentication and account flows

## 3. Dashboard Patterns
### KPI cards
Use for a small number of meaningful, well-defined metrics. Include labels and explain denominators where percentages are shown.

### Data tables
Include loading, empty, error, and populated states. For large datasets, use server-side pagination and validated filters.

### Filters
- Keep filter labels explicit.
- Validate date ranges and numeric values on both client and server.
- Provide a clear/reset action.
- Preserve filters during pagination where appropriate.

### Status indicators
Use the actual enum/status values from the backend. Do not infer a state from missing data.

## 4. Key User Flows
### Student applies to a drive
1. Sign in.
2. Review profile and eligibility information.
3. Open a drive.
4. Submit application.
5. See a clear success or actionable validation error.
6. Track application and interview status.

### TPO publishes an announcement
1. Create a draft.
2. Review draft.
3. Publish.
4. Students can view only published announcements.

### TPO reviews analytics
1. Open the authorized dashboard.
2. Select supported filters.
3. Review aggregate metrics.
4. Export only approved, non-sensitive data if export is implemented.

## 5. UX States
Every data-driven page should handle:
- Initial loading
- Empty results
- Validation errors
- Authorization failure
- Network/server failure
- Successful operation
- Stale or refreshed data, where relevant

## 6. Accessibility Checklist
- Inputs have associated labels.
- Buttons have descriptive accessible names.
- Status is not conveyed by color alone.
- Focus order is logical.
- Tables have headers.
- Dialogs manage focus appropriately.
- Charts include textual summaries or accessible alternatives.

## 7. Design Tokens
Document existing tokens after inspecting the frontend:
- Color palette
- Typography scale
- Spacing scale
- Border radius
- Elevation/shadows
- Breakpoints

Do not introduce a new design system without checking existing CSS and components first.
