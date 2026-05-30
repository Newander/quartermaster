# Public attendance implementation plan

## Goal

Add a trusted self-service attendance flow for external users without login and
password, while keeping instructor control inside the existing authenticated CRM.

The chosen design is the hybrid variant:

- external users write directly to real `TrainingSessionAttendance` records;
- every external and instructor change is recorded in an audit log;
- each device is assigned to exactly one member at a time;
- the assigned member can be removed from the device with a dedicated action;
- the public frontend uses only new public backend routes with no role-based
  permission dependencies;
- new database tables also receive ordinary CRM table interfaces for internal
  inspection and administration.

## Product rules

### External users

- No login, password, personal QR code, or personal invite link.
- The public page is optimized for mobile use and does not use the authenticated
  CRM shell/sidebar.
- On first visit, the browser receives a random device token.
- The raw device token is stored only in the browser, for example in
  `localStorage`.
- The backend stores only a hash of the device token.
- A device can have only one assigned member at a time.
- The user can remove the assigned member from the device by pressing
  "убрать назначенного пользователя".
- After removing the assignment, the same device identity remains active, but
  `assigned_member_id` becomes `null`.
- The public UI first shows the current day.
- The user can scroll backward through days in the allowed attendance window.
- The public UI is not a table. It is a day-by-day vertical list of session
  cards.
- External edits are allowed only for today and the configured past window.
  Recommended default: today plus the previous 7 calendar days.
- The public API must never accept arbitrary `member_id` in attendance mutation
  payloads. The member is resolved from the current device assignment.

### Instructors

- Instructor attendance editing stays inside the authenticated CRM.
- The existing `training-session-sheet` remains the main instructor surface.
- Instructor edits are final operational edits, but still logged.
- Instructor UI must show whether a row was last edited externally or by an
  instructor.
- Instructor UI must make external edits visible without requiring a separate
  workflow before the attendance becomes useful.

### Administrators and internal users

- New tables must be visible in the CRM as ordinary table pages:
  `public-device-identity` and `attendance-change-log`.
- These pages are for inspection, cleanup, debugging, and support.
- The public page must not depend on these internal CRUD pages.

## Data model

### Existing table extension

Extend `training_session_attendance_m2m`:

```text
source
device_identity_id
self_reported_at
instructor_verified_at
```

Field meanings:

- `source`: enum or string value, one of `instructor`, `external_device`.
- `device_identity_id`: nullable FK to `public_device_identity.id`.
- `self_reported_at`: timestamp of the latest external-device edit.
- `instructor_verified_at`: timestamp of the latest instructor edit or
  explicit instructor confirmation.

Add a unique constraint:

```text
unique(session_id, member_id)
```

Before adding the constraint, the migration must deduplicate existing
attendance rows by `(session_id, member_id)`. Keep the newest row by `id` or
`updated_at`, and remove older duplicates after preserving enough information
in migration comments or an ad hoc backup if needed.

### `public_device_identity`

```text
id
token_hash unique not null
assigned_member_id nullable FK -> member.id
created_at
updated_at
last_seen_at
assignment_changed_at
is_active
notes nullable
```

Notes:

- `token_hash` is a hash of a server-issued random token.
- The raw token is returned only once to the browser when a new device identity
  is created.
- `assigned_member_id = null` means the device is known, but not currently
  assigned to a person.
- `is_active = false` lets internal users disable a device without deleting
  historical links.

### `attendance_change_log`

```text
id
attendance_id nullable FK -> training_session_attendance_m2m.id
session_id not null FK -> training_session.id
member_id not null FK -> member.id
device_identity_id nullable FK -> public_device_identity.id
changed_by not null
previous_attended nullable
new_attended nullable
previous_notes nullable
new_notes nullable
changed_at not null
```

`changed_by` values:

- `external_device`
- `instructor`

The log should be append-only in normal application behavior. Internal CRUD can
show it, but deletion should be restricted to admin-level maintenance if
possible.

## Backend routing

### Public router

Create a new backend module, for example:

```text
backend/app/api/public_attendance.py
```

Include it from `backend/app/api/router.py` under:

```text
/api/public/attendance
```

Do not attach `is_member_dep`, `is_instructor_dep`, or any other authenticated
role dependency to this public router.

The public router should use a device-token dependency instead:

```text
X-Public-Device-Token: <raw token>
```

Recommended behavior:

- if a route requires only a device, reject missing/invalid tokens with `401`;
- if a route requires an assigned member, reject known unassigned devices with
  `409` and a structured error code such as `member_not_assigned`;
- refresh `last_seen_at` on valid public requests.

### Public API contracts

#### `POST /api/public/attendance/device`

Create or restore public device identity.

Request:

```json
{
  "device_token": "optional existing raw token"
}
```

If `device_token` is omitted or unknown, create a new identity and return a new
raw token.

Response:

```json
{
  "device_id": 12,
  "device_token": "returned only when newly created",
  "has_assigned_member": true,
  "assigned_member": {
    "id": 5,
    "first_name": "Jan",
    "last_name": "Kowalski"
  }
}
```

#### `GET /api/public/attendance/member-search?q=...`

Search members for device assignment.

Rules:

- no authentication;
- rate-limit later if needed;
- return only minimal public-safe fields;
- exclude deleted/inactive members by default.

Response:

```json
{
  "records": [
    {
      "id": 5,
      "first_name": "Jan",
      "last_name": "Kowalski",
      "display_hint": "Jan Kowalski"
    }
  ]
}
```

If same-name collisions are common, add a safe disambiguator such as birth year
or membership number. Do not expose full email or phone in this public endpoint.

#### `PUT /api/public/attendance/device/assigned-member`

Assign the current device to exactly one member.

Headers:

```text
X-Public-Device-Token: <raw token>
```

Request:

```json
{
  "member_id": 5
}
```

Response:

```json
{
  "device_id": 12,
  "assigned_member": {
    "id": 5,
    "first_name": "Jan",
    "last_name": "Kowalski"
  }
}
```

#### `DELETE /api/public/attendance/device/assigned-member`

Remove the member assignment from the current device.

Headers:

```text
X-Public-Device-Token: <raw token>
```

Response:

```json
{
  "device_id": 12,
  "has_assigned_member": false,
  "assigned_member": null
}
```

This is the backend contract for the public UI action
"убрать назначенного пользователя".

#### `GET /api/public/attendance/days`

Return the scrollable day window for the currently assigned member.

Headers:

```text
X-Public-Device-Token: <raw token>
```

Query:

```text
start_date optional
end_date optional
```

Default window:

```text
start_date = today - 7 days
end_date = today
```

Response shape:

```json
{
  "member": {
    "id": 5,
    "first_name": "Jan",
    "last_name": "Kowalski"
  },
  "start_date": "2026-05-07",
  "end_date": "2026-05-14",
  "today": "2026-05-14",
  "days": [
    {
      "date": "2026-05-14",
      "is_today": true,
      "sessions": [
        {
          "session_id": 31,
          "schedule_id": 8,
          "training_form_name": "Longsword",
          "start_time": "18:00",
          "end_time": "19:30",
          "instructors": ["Anna Nowak"],
          "is_cancelled": false,
          "attended": true,
          "attendance_id": 44,
          "source": "external_device",
          "self_reported_at": "2026-05-14T18:42:00",
          "instructor_verified_at": null,
          "updated_at": "2026-05-14T18:42:00"
        }
      ]
    }
  ]
}
```

Backend responsibilities:

- use existing schedule/session data;
- create missing `TrainingSession` rows for schedule occurrences if the current
  application pattern already does that elsewhere, or document that sessions
  must already exist;
- return days sorted descending, with today first;
- return sessions inside each day sorted by `start_time`;
- do not return member lists or other private CRM data.

#### `PUT /api/public/attendance/sessions/{session_id}`

Set or update attendance for the assigned member.

Headers:

```text
X-Public-Device-Token: <raw token>
```

Request:

```json
{
  "attended": true
}
```

Response:

```json
{
  "attendance_id": 44,
  "session_id": 31,
  "member_id": 5,
  "attended": true,
  "source": "external_device",
  "self_reported_at": "2026-05-14T18:42:00",
  "instructor_verified_at": null
}
```

Rules:

- resolve `member_id` only from the current device assignment;
- reject sessions outside the allowed date window with `403`;
- upsert by `(session_id, member_id)`;
- write `source = external_device`;
- write `device_identity_id`;
- write `self_reported_at = now()`;
- append `attendance_change_log` with previous and new values.

### Internal CRM routes

Add standard `RouteAlchemyManager` CRUD resources for:

- `public_device_identity`;
- `attendance_change_log`.

Suggested API prefixes:

```text
/api/public-device-identity
/api/attendance-change-log
```

These are authenticated internal CRM routes, not public routes. Permissions can
start with instructor access for read-only inspection and admin access for
destructive actions, or follow the project's closest existing admin/debug data
pattern.

Also add navigation ids:

```text
public-device-identity
attendance-change-log
```

Recommended initial access:

- `public-device-identity`: instructor can view, admin can edit/delete;
- `attendance-change-log`: instructor can view, admin can delete only if needed.

## Instructor interface

### Existing page

Extend:

```text
frontend/src/pages/training-session-sheet.tsx
```

Required additions:

- show attendance source for each row;
- show external self-report timestamp when present;
- show instructor verification timestamp when present;
- visually distinguish external-device rows from instructor-edited rows;
- when instructor saves a row, backend logs `changed_by = instructor`;
- instructor save should set `source = instructor` or
  `instructor_verified_at = now()` depending on final backend choice.

The page can keep its current table layout because it is an internal
instructor workflow.

### Optional internal history view

Add a compact action per attendance row:

```text
History
```

It can open a sheet/dialog and load:

```text
GET /api/training/training-session/{session_id}/attendance-changes
```

This can be implemented after the first working version if the standard
`attendance-change-log` CRUD page is already available.

## Public frontend

### Route

Add a standalone route:

```text
/public/attendance
```

This route must be accessible without authenticated app state and must not
render the CRM `Shell`.

Frontend routing changes:

- add a public route constant in `frontend/src/lib/router.ts`;
- branch in `frontend/src/App.tsx` before authenticated route handling;
- create `frontend/src/pages/public-attendance.tsx`.

### Device state

Use a dedicated localStorage key:

```text
hema_public_device_token
```

Startup flow:

1. Read token from localStorage.
2. Call `POST /api/public/attendance/device`.
3. If response contains a newly issued token, store it.
4. If no assigned member, show member assignment view.
5. If assigned member exists, show day list.

### Member assignment view

The view contains:

- search input;
- list of matching members;
- assign/select button per result.

After successful assignment:

- reload `GET /api/public/attendance/days`;
- show the current-day-first day list.

### Assigned-member header

When a member is assigned, the top area shows:

- assigned member name;
- compact action: "убрать назначенного пользователя".

The remove action:

1. calls `DELETE /api/public/attendance/device/assigned-member`;
2. clears member-specific state;
3. keeps the device token in localStorage;
4. returns to the member assignment view.

### Day list UI

The public page shows a vertical day window:

- today first;
- older days below;
- each day has a date heading;
- each session is a compact card;
- no table layout;
- session card has a two-state attendance control.

Session card content:

```text
18:00-19:30
Longsword
Anna Nowak
[ Был ] [ Не был ]
```

Behavior:

- optimistic update is allowed, but rollback on API error;
- disabled state for cancelled sessions;
- loading state per changed session;
- simple error banner if the device assignment was removed or invalidated.

## CRM pages for new tables

Add frontend pages using the existing generic CRUD page pattern:

```text
frontend/src/pages/public-device-identity.tsx
frontend/src/pages/attendance-change-log.tsx
```

Add to:

- `frontend/src/lib/router.ts`;
- `frontend/src/lib/main-navigation.tsx`;
- `frontend/src/App.tsx`;
- backend `NavigatorAccessMap`.

The pages should use the new internal backend CRUD routes, not the public
routes.

## Migration and metadata

Create an Alembic migration that:

1. creates `public_device_identity`;
2. creates `attendance_change_log`;
3. adds the new columns to `training_session_attendance_m2m`;
4. backfills `source = instructor` for existing attendance rows;
5. deduplicates existing `(session_id, member_id)` conflicts;
6. adds the unique constraint for `(session_id, member_id)`;
7. adds indexes for:
   - `public_device_identity.token_hash`;
   - `public_device_identity.assigned_member_id`;
   - `attendance_change_log.session_id`;
   - `attendance_change_log.member_id`;
   - `attendance_change_log.device_identity_id`;
   - `attendance_change_log.changed_at`.

Because the new tables will be shown in CRM CRUD interfaces, include
`field_description` records for their visible fields and for the newly visible
attendance metadata if it appears in generated forms or tables.

## Implementation order

1. Add backend models and enums:
   - `PublicDeviceIdentity`;
   - `AttendanceChangeLog`;
   - attendance source enum or constrained string values.

2. Add Alembic migration:
   - tables;
   - attendance columns;
   - deduplication;
   - unique constraint;
   - indexes;
   - `field_description` metadata.

3. Add internal CRUD routes with `RouteAlchemyManager`:
   - `/api/public-device-identity`;
   - `/api/attendance-change-log`.

4. Add public attendance router:
   - device creation/restoration;
   - member search;
   - assign member;
   - remove assigned member;
   - day window;
   - session attendance upsert.

5. Update instructor attendance writes:
   - preserve existing behavior;
   - set instructor source/verification fields;
   - append `attendance_change_log`.

6. Extend instructor sheet UI:
   - source indicator;
   - self-report timestamp;
   - instructor verification timestamp;
   - optional history action.

7. Add public frontend route:
   - standalone page outside authenticated shell;
   - device-token storage;
   - member assignment;
   - current-day-first day list;
   - scroll backward through the allowed window;
   - attendance toggle per session.

8. Add CRM table pages for new tables:
   - route constants;
   - navigation items;
   - `App.tsx` branches;
   - generic CRUD pages.

9. Regenerate frontend API docs/types if the project workflow requires it:
   - backend OpenAPI export;
   - `frontend/src/types/api.generated.ts`;
   - generated frontend API docs.

10. Verify:
    - backend tests or targeted API checks for public routes;
    - migration upgrade on existing local database copy;
    - frontend build;
    - manual browser check of `/public/attendance`;
    - manual check of instructor sheet after external edit;
    - manual check of CRM pages for new tables.

## Open implementation decisions

- Whether instructor save should always overwrite `source` to `instructor`, or
  keep `source = external_device` and only set `instructor_verified_at`.
  Recommended: keep `source` as "last writer" and use the log for full history.
- Whether public user can set only `attended = true`, or can explicitly set
  `attended = false`.
  Recommended: allow both, because the user asked for editing attendance, not
  only marking presence.
- Whether the past window is exactly 7 previous days or the current calendar
  week.
  Recommended: today plus 7 previous calendar days, because it matches the
  scroll-back interaction and avoids Monday boundary surprises.
- Whether missing `TrainingSession` rows should be generated on demand by the
  public day endpoint.
  Recommended: reuse the existing session-generation lifecycle if reliable; if
  not, add a shared helper and use it in both scheduled generation and public
  day reads.
