# Test results - 20261006-recurrence2

## Executed and passed

**37 Node tests** (`npm test`):

- Daily, Weekly, Monthly, leap year and year-boundary date calculations.
- Invalid recurrence/date validation before writes.
- UTC-to-local completion-day conversion (Asia/Karachi).
- Due-date versus completion-date filtering and immutable completion due dates.
- Preservation of recorded completion time; unknown legacy completion times remain unknown.
- Parent/child field copying and compatibility with the old deterministic recurrence IDs.
- Production Firebase adapter code running against an in-memory transactional Firestore double.
- Owner, Manager and assigned VA completion paths.
- Rollback when the simulated child write is denied.
- Simulation of the old missing-document-read denial.
- Repeat/concurrent completion and reuse of an already existing child.
- Full edits and creation of tasks directly as Completed.
- Explicit recovery of a manually moved date or missing recurrence frequency.
- Stale-preview rejection, preservation of historical timestamps and no changes on failed repair.
- Adapter-side rejection of unauthorized fields, other users' tasks, cross-agency edits and inactive users.

**17 offline Chromium browser checks** (`python tests/browser-smoke.py`):

- Shared script boot and inline recurring completion.
- Yesterday Due Date history, including completed snapshots.
- Completed On filters, including the local-midnight timezone case.
- Default Dashboard hides old completed work; explicit historical filters show it.
- VA All Dates filter stays selected.
- Recovery frequency selection, date preview, confirmation and successful repair.
- No duplicate after repeated completion.
- Completed dates protected in inline and full-edit UI.
- Calendar completion history, user filters and month navigation.
- Create-new recurring tasks directly as Completed.
- Task backup export.
- No JavaScript exceptions in the exercised desktop/mobile flows.

The browser checks use a synthetic offline demo fixture. Production HTML/CSS/JavaScript is
injected into the browser with an in-memory localStorage double. No production accounts or
records were used. Desktop screenshots were visually reviewed.

## Not executed / not verified

- **Real Firestore emulator / Rules compiler:** not run. This environment could not download
  the Firebase SDK and emulator (external package-network access unavailable). The separate
  `tests/firestore-emulator.cjs` suite is supplied for use with `npm run test:rules` on a
  machine with the required dependencies. It must not be represented as a passed test.
- **Deployed production rules:** not inspected, published or tested.
- **Real Firebase authentication, email delivery, live data and hosting:** not accessed.
- **Unknown historical dates/timestamps:** not recoverable from the source ZIP alone.

The rules change was code-reviewed against Firebase's documented `get`, `list`, `getAfter`,
Map.get and agency-scoped query semantics. Local adapter tests do not replace Rules-engine
validation. After publishing both the app and the rules, verify one test task as Manager
and one as the assigned VA before the team resumes normal work.

## Safety and scope

The original source ZIP remains untouched. The Firebase client configuration is unchanged.
No bulk migration runs when the updated application loads. Recovery requires explicit
user action and date/frequency confirmation. A failed recovery transaction leaves the
original record unchanged. Optional emulator tests use only a local `demo-` project.
