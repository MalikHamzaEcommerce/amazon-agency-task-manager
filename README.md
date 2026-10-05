# Amazon Agency Task Manager - Workflow Upgrade

This build keeps the existing Firebase Auth + Firestore architecture and adds the requested task workflow improvements.

## New in this build

- Login password **Show / Hide** control.
- **Forgot Password?** sends a Firebase Authentication password-reset email.
- Task status **Awaiting** replaces the old “Waiting on Client” wording; legacy records are normalized in the UI.
- Recurring task completion keeps the completed occurrence in history and automatically creates the next **Not Started** occurrence for Daily / Weekly / Monthly recurrence.
- Recurring occurrences use a series ID + deterministic next-occurrence document ID to prevent accidental duplicates.
- Tasks page date filters: **All Dates, Today, Yesterday, Tomorrow, Select Date**.
- Owner/Manager can edit **Assigned To, Source, Priority, Due Date, Status** directly from task tables.
- Assigned VAs can change their own task **Status** directly from the table.
- “Received By” is renamed to **Assigned By** in the UI; the existing Firestore field is kept for backward compatibility.
- Calendar supports **Previous / Next month**, clickable dates, historical task viewing, and a per-date **user filter**.
- Completed tasks from earlier due dates are removed from the Dashboard current-task list but remain available in Calendar/history.
- Dashboard **Tasks by VA** names are clickable. The expanded panel has date filters and Assigned / Completed / Pending / Awaiting / Overdue counts plus that VA’s task list.
- Dashboard summary is current-work focused; Reports remains the historical view.

## Roles

### Owner
Full access, including Manager role governance.

### Manager
Full operational account/task access; may manage VAs but cannot govern Owner/Manager roles.

### VA
May view agency work, update the status of tasks assigned to their own login, and add/view notes on their assigned tasks.

## Files to upload to GitHub

Replace the repository-root copies of:

- `index.html`
- `styles.css`
- `app.js`
- `firebase-adapter.js`
- `config.js`
- `config.example.js`
- `firestore.rules`
- `README.md`
- `UPDATE-STEPS.txt`

## Required Firebase step

After GitHub upload, open **Firebase Console -> Firestore Database -> Rules**, replace the rules with this build’s complete `firestore.rules`, and click **Publish**. This is required so an assigned VA can atomically create the next recurring occurrence when they complete a recurring task.

Firebase Authentication must have Email/Password enabled for login and password-reset email delivery.

## Recurring-task behavior

Example: a Weekly task due Oct 5 is marked Completed. The Oct 5 task stays Completed for history/reporting, while a new Oct 12 task is created as Not Started. Completing Oct 12 creates Oct 19, and so on.

Security note: Account Login Access credentials remain restricted to Owner/Manager by UI and Firestore rules. A dedicated password manager is safer for production marketplace credentials.
