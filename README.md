# Amazon Agency Task Manager - Firebase Edition

A GitHub-Pages-friendly dashboard for Amazon agencies. It includes Dashboard, Accounts, Tasks, My Tasks, Team/VAs, Calendar, Reports, Settings, task assignment, task source, priority, due dates, status, recurring tasks, owner/VA accounts, and agency invite codes.

## Architecture

- **GitHub** stores the website code.
- **GitHub Pages** hosts the live dashboard.
- **Firebase Authentication** provides separate owner/VA logins.
- **Cloud Firestore** stores agencies, accounts, tasks and team profiles.

The Firebase web configuration in `config.js` is client-side configuration. Never add service-account JSON, private keys, passwords, or other server credentials to GitHub.

## Files

- `index.html` - app entry point and Firebase SDK loading
- `styles.css` - dashboard styles
- `app.js` - dashboard UI and task/account flows
- `firebase-adapter.js` - Firebase Auth/Firestore data layer
- `config.js` - Firebase web app configuration
- `firestore.rules` - production security rules to deploy after initial testing

## Initial testing

If Firestore was created in **Test mode**, upload these files to GitHub and verify:

1. The live site shows a Sign In / Create Account screen instead of Demo Mode.
2. Create the owner account.
3. Create the agency.
4. Add an Amazon account and task.
5. Refresh the page and confirm the data persists.

After that, deploy the supplied `firestore.rules` in Firebase Console > Firestore > Rules before relying on the app for real client data.

## Owner / VA flow

1. Owner creates an account and chooses **Create Agency**.
2. Firebase creates an agency and an invite code.
3. Owner shares the live dashboard URL and invite code with a VA.
4. VA creates their own login and chooses **Join Agency**.
5. Owner can assign tasks to the VA; the VA sees them under **My Tasks**.

## Security notes

Do not put Seller Central passwords, OTPs, banking credentials, service-account keys, or private API secrets in task notes. Firebase web config values are not server secrets; access control is enforced through Firebase Authentication and Firestore Security Rules.
