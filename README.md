# Amazon Agency Task Manager - Final Firebase Build

This is the consolidated Firebase version of the dashboard.

## Included features
- Owner and VA email/password login with Firebase Authentication
- Agency invite-code flow
- Accounts, tasks, My Tasks, Team/VAs, Calendar, Reports and Settings
- Owner-only account/task creation, editing and deletion
- VA can view agency work but cannot delete accounts/tasks
- VA can update status only on tasks assigned to their own login
- VA can add append-only notes to their assigned tasks
- Owner can view and add notes on agency tasks
- Firestore security rules enforce permissions server-side

## Files to upload to GitHub repository root
- `index.html`
- `styles.css`
- `app.js`
- `firebase-adapter.js`
- `config.js`
- `config.example.js`
- `firestore.rules`
- `README.md`

## Deploy/update steps
1. Upload all files above to the existing GitHub repository root and replace same-name files.
2. Commit the changes.
3. Wait for GitHub Pages to deploy, then hard-refresh the live site (`Ctrl+F5`).
4. In Firebase Console open **Firestore Database -> Rules**.
5. Replace the current rules with the complete contents of `firestore.rules` and click **Publish**.
6. Test with the Owner account and a VA account in a separate/incognito browser.

## Expected permissions
### Owner
- Full account/task/team control
- Create/edit/delete accounts and tasks
- Assign tasks to VAs
- Update any task status
- Add/view task notes

### VA
- View agency accounts/tasks
- Update status only for tasks assigned to their own login
- Add/view notes only on tasks assigned to them
- Cannot delete accounts/tasks
- Cannot change task assignment, priority, due date, account or core task details

## Security note
The Firebase web config in `config.js` is client configuration and is expected to be visible in a browser. Actual access control is enforced through Firebase Authentication and the `firestore.rules` security rules.

Do not put Seller Central passwords, OTPs, banking details, service-account credentials or other secrets into task notes.

## Status color highlighting
Task rows and calendar items are color-coded automatically:
- Complete: green
- In Progress: blue
- Waiting on Client: purple
- Not Started: amber
- Blocked / Overdue: red

## Owner: remove a VA
The owner can open **Team / VAs -> Edit -> Remove VA**. Removal is a secure soft-delete: the VA immediately loses agency access, disappears from the active team, and any open tasks assigned to that VA become unassigned. Completed-task attribution and task-note history remain available for audit/history. Firebase Authentication does not allow one browser user to delete another user's Auth account directly, so the login record remains in Firebase Auth but cannot access agency data.
