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


## Latest update: Client-first Accounts + smooth refresh
- Accounts opens with a list of clients first.
- Selecting a client drills into that client's accounts.
- Back button and quick client switcher are included.
- Firebase Auth hydration is awaited on refresh, preventing the login screen from flashing for signed-in users.
- Existing route/hash is restored before the first app render.


## Latest three updates

1. **Account Login Access**: Owners and Managers see a `Login Access` button on each account. The credentials live in the separate `account_credentials` Firestore collection and Firestore rules deny VA access.
2. **Former member record deletion**: the Owner can permanently delete a removed member's Firestore profile record. Firebase Authentication is separate; the person's Auth login is not deleted by this frontend-only app. If you need the same email to be available for a brand-new Firebase signup, delete that user manually in Firebase Console -> Authentication -> Users.
3. **Task status wording**: `Completed` replaces `Complete`, and legacy `Complete` / `Not Start` values are normalized to `Completed` / `Not Started` in the UI.

Security note: storing Amazon passwords directly in Firestore is more sensitive than ordinary task data. The feature is restricted to Owner/Manager by both UI and Firestore rules, but a dedicated password manager is safer for production credentials.
