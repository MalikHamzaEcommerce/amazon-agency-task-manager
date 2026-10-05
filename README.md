# Amazon Agency Task Manager - Recurrence and History Fix

Build: **20261006-recurrence2**. Based on the uploaded workflow-upgrade-2026-10-05 ZIP.

This is still the same static web app using Firebase Authentication and Cloud Firestore.
The supplied `config.js` is unchanged. No Firebase project, production database or live rules
were accessed or changed while preparing this update.

## The fixes

1. **Missing recurring document read.** The previous transaction checked whether its next
   occurrence existed, but the task read rule required that missing document's `agency_id`.
   The new rules allow active members to check missing `rec_*` document IDs. Existing tasks
   and collection queries remain scoped to the user's agency. This is NOT an allow-all rule.
2. **No half-saved completion.** Inline status changes, full task edits and new completed tasks
   now save the completed parent and its next occurrence in one transaction. A denied write
   leaves both unchanged. Existing next-occurrence IDs are reused, not overwritten.
3. **Recover earlier failures explicitly.** Settings and the Tasks/Dashboard warning open
   Recurring Recovery. Review the original due date and frequency, then create only the
   missing next occurrence. Recovery preserves `completed_at`; corrected due dates/frequencies
   receive repair metadata. No automatic bulk rewriting or guessed historical dates.
4. **Due Date versus Completed On.** Tasks, Dashboard filters, Calendar and the VA details
   panel can distinguish scheduled work from work actually completed on a selected day.
   Completion timestamps are converted to the viewer's local date, not sliced as UTC dates.
5. **Keep completed history.** New completions store `completion_due_date`. Their date is
   read-only in normal inline/modal editing. Use recovery to correct a manually moved date
   only when the next occurrence is missing and the original date is known.
6. **Dashboard history works.** Past completed work is hidden in the default current list,
   but selecting a date or completion-history filter uses the full task history. VA All Dates
   no longer resets itself to Today. Calendar uses equal-width day columns.
7. **Safer error handling.** Failed data refreshes no longer silently turn the task list into
   an empty history. Recovery/export is disabled after an incomplete refresh. A modal
   backdrop handler no longer references a removed element while closing.

The earlier login, Awaiting, inline editing, Assigned By, Calendar navigation and team
features are retained.

## Deployment

Follow `UPDATE-STEPS.txt`. Upload the app files together, including the NEW
`task-workflow.js`, and separately publish the complete `firestore.rules` in the SAME Firebase
project as `config.js`. Keep a copy of the previous code/rules first. Confirm both the site
and rules are deployed before the team resumes completing tasks. Hard-refresh open tabs.

`package.json`, `firebase.test.json`, and `tests/` are optional development tests. They are
not required to run or deploy this static app. Do not upload `node_modules` or change your
hosting method to run these tests.

## Recurrence contract

A Daily task due October 5, completed by the user, stays Completed for October 5. One NEW
Not Started task is created for October 6. Weekly adds seven days; Monthly goes to the next
month and clamps a nonexistent day to that month's last day. Titles are retained; each
occurrence has its own due date, status and record ID.

The next date is based on the completed occurrence's due date, NOT its completion time.
This update does not skip missed dates: completing an old October 3 Daily task creates
October 4, even when the current date is October 6. Review overdue occurrences normally.
There is no midnight scheduler; creation happens when completion or explicit repair is saved.
An unfinished recurring task does not generate another task just because midnight passes.

## Recovering the reported October 5 / October 6 case

After deployment, use **Settings -> Download Task Backup** first. That JSON exports current
loaded task records only, not account passwords or authentication tokens; it is not a full
Firestore backup or an automatic restore mechanism.

Then open **Settings -> Review Missing Occurrences** (or **Tasks -> Recurring Recovery**).
For a task whose original completed occurrence really was due October 5 but was manually
moved to October 6, choose Daily and set **Completed occurrence's original due date** to
October 5. The preview should say October 6 - Not Started. Click Create Next Task and confirm.
The old task remains Completed on October 5, its original completion timestamp is kept,
and the October 6 task is a separate record. Repeat only for known affected tasks.

Already-created next occurrences are not duplicated. Recovery will not alter a chain whose
next occurrence already exists. Review the real records before repairing intentionally
deleted future occurrences. Turning Recurring off on an old parent does not automatically
delete an already generated child; manage that child deliberately.

**Do not toggle old completed tasks to Not Started just to retry recurrence.** Reopening a
task is a real status change and clears its completion timestamp. Use recovery instead.

## Finding yesterday's work

- Work that was **due** yesterday: Tasks -> Due Date -> Yesterday.
- Work that was **finished** yesterday: Tasks -> Completed On -> Yesterday. Clear other
  account/user/status filters if the expected tasks are excluded.
- Calendar has the same Due Date / Completed On selector. Click the day NUMBER and filter
  by user. Clicking a task title instead opens that particular task.
- Calendar Due Date and Completed On are two views of the same records, not duplicated tasks.
- Tasks without a saved completion timestamp remain accessible in Due Date / All Dates;
  their actual completion day cannot safely be inferred.

Manually moved records from the previous build did not necessarily retain their original
due date. The application cannot reconstruct dates or completion timestamps that were
overwritten, or restore deleted records, without known values or a suitable backup.

## Validation and development

See `TEST-RESULTS.md` for the exact executed tests and limits. Node workflow/adapter tests
and offline Chromium UI checks passed. Real Firestore emulator/rules tests are supplied
but were NOT executed here; the emulator/SDK could not be downloaded in this environment.
Production authentication, deployed rules and real data remain unverified until deployment.

Fast tests (Node 18+; no dependency installation needed):

```sh
npm test
```

Optional real rules tests (Node 20+, Java 21 and internet for initial installs):

```sh
npm install
npm run test:rules
```

The test command is fixed to the local `demo-recurrence-tests` emulator project. It does
not deploy rules or access the production project in `config.js`.

Optional offline browser smoke test (Python + Playwright/Chromium):

```sh
python -m pip install playwright
python -m playwright install chromium
python tests/browser-smoke.py
```

The browser test injects production app scripts into an offline synthetic fixture. It uses
an in-memory localStorage double and does not contact Firebase. Outputs go to `test-output/`.

## Firebase references

- Transactions and atomic writes: https://firebase.google.com/docs/firestore/manage-data/transactions
- Security rule conditions and `getAfter`: https://firebase.google.com/docs/firestore/security/rules-conditions
- Publishing rules: https://firebase.google.com/docs/firestore/security/get-started
- Security rule tests: https://firebase.google.com/docs/firestore/security/test-rules-emulator
