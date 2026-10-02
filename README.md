# Amazon Agency Task Manager

A static, GitHub-Pages-friendly task dashboard for Amazon agencies. It includes Dashboard, Accounts, Tasks, My Tasks, Team/VAs, Calendar, Reports, Settings, quick-add forms, task source, assignment, priority, due dates, status, and Supabase authentication/database support.

## Recommended architecture

- **GitHub**: stores your website code/history.
- **GitHub Pages**: hosts the live dashboard URL for free.
- **Supabase**: stores the database and handles secure login for you and your VAs.
- **Browser**: the dashboard connects to Supabase using the public anon key. Security is enforced by Row Level Security (RLS).

Your actual client/task data is **not stored in GitHub** once Supabase is configured.

## 1. Try the dashboard immediately

The included `config.js` is empty, so the app starts in **Demo Mode** with sample accounts/tasks stored in your browser (`localStorage`). Open `index.html` through any static web server or publish it to GitHub Pages.

## 2. Create the real database

1. Create a free project at https://supabase.com
2. Open **SQL Editor**.
3. Paste and run `supabase-schema.sql`.
4. Go to **Project Settings > API** and copy:
   - Project URL
   - `anon` / public key
5. Put them in `config.js`:

```js
window.APP_CONFIG = {
  SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_PUBLIC_ANON_KEY',
  APP_NAME: 'Amazon Account Task Manager'
};
```

**Never put the Supabase service-role key in this project or GitHub.** The anon key is designed to be public when RLS policies are enabled.

## 3. First owner setup

1. Open the live dashboard.
2. Click **Sign up** and create your owner account.
3. After login, create your agency name.
4. Settings will show your agency's **Invite Code**.

## 4. Add your VAs

1. Share the live GitHub Pages URL with a VA.
2. VA signs up with their own email/password.
3. VA selects **Join Agency** and enters your Invite Code.
4. Their profile appears on **Team / VAs**.
5. The owner can change their role between VA / Manager / Owner-style access as allowed by the app policy.

## 5. Publish on GitHub Pages

1. Create a new GitHub repository, e.g. `amazon-agency-task-manager`.
2. Upload/push all files in this folder.
3. In GitHub: **Settings > Pages**.
4. Set source to **Deploy from a branch**, branch `main`, folder `/root`.
5. GitHub gives you a live URL similar to:
   `https://YOURUSERNAME.github.io/amazon-agency-task-manager/`
6. Share that URL with your VAs.

## Data model

- `agencies`: your agency and invite code.
- `profiles`: owner/managers/VAs.
- `accounts`: Amazon client accounts.
- `tasks`: tasks, assignment, source, status, priority, due date, recurring flag.

## Security notes

- Each user logs in separately.
- Row Level Security limits records to the user's agency.
- Do not store Amazon Seller Central passwords, API secrets, OTPs, bank details, or client passwords in task notes.
- For production, enable MFA for owner accounts and review Supabase Auth settings.

## Future upgrades

Useful next steps: task comments, file attachments, automatic recurring tasks, email/Slack notifications, activity logs, client portal, Amazon SP-API metrics, time tracking, and VA performance dashboards.
