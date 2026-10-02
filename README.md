# Amazon Agency Task Manager - Manager Role Build

This build adds a **Manager** role while preserving the existing Owner and VA workflow.

## Roles

### Owner
- Full access to accounts, tasks, calendar, reports, notes, agency settings and team operations.
- Can promote a VA to **Manager** or demote a Manager back to **VA**.
- Can remove and restore both VAs and Managers.
- The Owner account itself cannot be removed or demoted.

### Manager
- Full operational access to the dashboard.
- Can create, edit and delete accounts.
- Can create, edit, assign and delete tasks.
- Can update any task status and view/add notes on any task.
- Can view reports, calendar and all agency work.
- Can see the invite code and invite new VAs.
- Can edit, pause, remove and restore **VA** accounts.
- Can edit the agency name.
- Cannot change the Owner, grant/remove the Manager role, or remove/restore another Manager. Those governance controls stay Owner-only.

### VA
- Can view agency accounts/tasks.
- Can update status only for tasks assigned to their own login.
- Can add/view notes only on tasks assigned to them.
- Cannot create/delete accounts or tasks and cannot manage the team.

## How the Owner promotes a VA to Manager
1. Open **Team / VAs**.
2. Click **Edit** next to the VA.
3. Change **Role** from `VA` to `Manager`.
4. Click **Save**.
5. The user can refresh the dashboard and their role will show as **Manager** with full operational access.

## Files to upload to GitHub
Upload/replace these files in the repository root:
- `index.html`
- `styles.css`
- `app.js`
- `firebase-adapter.js`
- `config.js`
- `config.example.js`
- `firestore.rules`
- `README.md`

## Required Firebase step
After uploading to GitHub, open **Firebase Console -> Firestore Database -> Rules** and replace the current rules with the complete contents of the new `firestore.rules`, then click **Publish**.

The UI restrictions and Firestore security rules both enforce the Owner / Manager / VA hierarchy.
