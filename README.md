# 🗄️ Family Digital Document Locker

A **secure, private, static web application** for organizing and accessing your family's important documents. Built with plain HTML, CSS, and Vanilla JavaScript. Hosted on **GitHub Pages**. Powered entirely by the **Supabase Free Plan**.

---

## ⚠️ Security Warning

> This application is intended for **personal and family use only**.
>
> - Even with private Storage, Auth, RLS, and signed URLs implemented, **maintain a separate offline backup** of all irreplaceable original documents.
> - The Supabase Free plan does **not** provide the same backup/recovery guarantees as paid plans.
> - This application is **not** a certified banking-grade or HIPAA-compliant system.

---

## 🏗️ Architecture

```
        GitHub Pages
             │
             ▼
   Family Document Locker
      HTML / CSS / JS
             │
             ▼
         Supabase
  ┌────────┬────────┬────────┐
  │        │        │        │
 Auth  PostgreSQL  Storage  
        + RLS      Private   
                     │       
                     ▼       
               Signed URLs   
                     │       
           ┌─────────┼─────────┐
           ▼         ▼         ▼
         View     Download   Print
```

---

## 📁 Project Structure

```
family-document-locker/
│
├── index.html              ← Main SPA entry point
├── css/
│   └── styles.css          ← Premium UI stylesheet
├── js/
│   ├── supabase.js         ← ⚙️ SET YOUR CREDENTIALS HERE
│   ├── app.js              ← Main router & event bindings
│   ├── auth.js             ← Authentication module
│   ├── dashboard.js        ← Dashboard & family folders
│   ├── documents.js        ← Doc listing, viewing, downloading
│   ├── upload.js           ← Secure file upload with compression
│   ├── members.js          ← Admin: family members & permissions
│   └── utils.js            ← Shared helpers
└── supabase/
    ├── schema.sql          ← Step 1: Database tables & triggers
    ├── rls.sql             ← Step 2: Row Level Security policies
    └── storage-policies.sql← Step 3: Storage bucket policies
```

---

## 🚀 Complete Setup Guide

### Step 1 — Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click **Start your project** → sign up with GitHub or email.
3. **Do NOT add a payment method.** Stay on the **Free plan**.

---

### Step 2 — Create a New Supabase Project

1. In the Supabase dashboard click **New project**.
2. Enter a **project name** (e.g., `family-docs`).
3. Set a strong **database password** (save it securely, you won't use it in the app).
4. Choose a **region** closest to you.
5. Click **Create new project** and wait ~2 minutes for initialization.

---

### Step 3 — Initialize the Database

1. In your Supabase project, go to **SQL Editor** (left sidebar).
2. Click **New query**.
3. Copy the entire contents of `supabase/schema.sql` and paste into the editor.
4. Click **Run (Ctrl+Enter)**.
5. Verify no errors appear.

---

### Step 4 — Apply Row Level Security Policies

1. Still in **SQL Editor**, create another **New query**.
2. Copy the entire contents of `supabase/rls.sql` and paste.
3. Click **Run**.
4. Verify no errors appear.

---

### Step 5 — Set Up Private Storage Bucket

1. Create another **New query**.
2. Copy the entire contents of `supabase/storage-policies.sql` and paste.
3. Click **Run**.
4. Verify no errors appear.
5. Navigate to **Storage** in the left sidebar.
6. Confirm a bucket named `documents` appears and is marked **Private**.

---

### Step 6 — Enable Email Authentication

1. Go to **Authentication** → **Providers**.
2. Ensure **Email** is enabled (it is by default).
3. Optionally disable **Confirm email** if you don't want email verification for family members (Settings → Authentication → Uncheck "Enable email confirmations").

---

### Step 7 — Find Your API Keys

1. Go to **Project Settings** → **API**.

You will see:

| Key | Description |
|-----|-------------|
| **Project URL** | Your Supabase project URL — safe to use in frontend |
| **`anon` / public key** | Publishable API key — safe to use in frontend |
| **`service_role` key** | ⛔ SECRET — **NEVER** put this in your frontend code |

> **CRITICAL:** The `service_role` key bypasses ALL security policies. Never commit it to GitHub or put it in JavaScript code.

---

### Step 8 — Configure the App

Open `js/supabase.js` in a text editor and replace the placeholder values:

```javascript
// BEFORE
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_PUBLISHABLE_KEY = "YOUR_SUPABASE_PUBLISHABLE_KEY";

// AFTER (use your real values)
const SUPABASE_URL = "https://abcdefghijkl.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

Save the file.

---

### Step 9 — Create the First Admin Account

Because there is no custom backend, the first registered user is automatically assigned the **Admin** role by a database trigger that checks if the `profiles` table is empty.

**Steps:**

1. Open your app (locally or on GitHub Pages).
2. Click the **Register** tab on the login screen.
3. Enter your **full name**, **email**, and a **strong password**.
4. Click **Register Account**.
5. You will be automatically logged in as **Admin** (👑 Admin badge shown in header).

> All subsequent user registrations will receive the **Member** role by default. Only an Admin can promote another user to Admin via the Settings page.

---

### Step 10 — Deploy to GitHub Pages

1. Create a new **GitHub repository** (e.g., `family-documents`).
2. Push all the project files to the `main` branch.
3. In GitHub, go to your repository → **Settings** → **Pages**.
4. Under **Source**, select **Deploy from a branch** → choose `main` → folder `/` (root).
5. Click **Save**.
6. After a few minutes, your app will be live at:
   ```
   https://YOUR_USERNAME.github.io/family-documents/
   ```

> **Important:** Add the GitHub Pages URL to your Supabase project's **Allowed Redirect URLs** in Authentication → URL Configuration.

---

## 👥 User Roles

| Feature | Admin | Member |
|---------|-------|--------|
| Login | ✅ | ✅ |
| View authorized documents | ✅ | ✅ |
| Download documents | ✅ | ✅ |
| Print documents | ✅ | ✅ |
| Upload documents | ✅ | ❌ |
| Delete documents | ✅ | ❌ |
| Add/edit family members | ✅ | ❌ |
| Manage categories | ✅ | ❌ |
| Grant/revoke user access | ✅ | ❌ |
| Promote users to Admin | ✅ | ❌ |

---

## 🔐 How Signed URLs Work

Documents are stored in a **private** Supabase Storage bucket. No permanent public URLs exist.

When a user views or downloads a document:

1. User clicks a document.
2. The app verifies the active Supabase session (JWT).
3. RLS policies confirm the user is authorized.
4. App calls `supabase.storage.createSignedUrl(path, 300)` — generating a **temporary URL valid for 5 minutes**.
5. That URL is used to display/download the document.
6. After 5 minutes, the URL expires and becomes inaccessible.
7. Signed URLs are **never stored** in the database.

---

## 🔒 Security Checklist

Before going live, verify:

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **NOT** in any JavaScript file or GitHub repository
- [ ] The `documents` Storage bucket is set to **Private**
- [ ] No `getPublicUrl()` calls exist anywhere (only `createSignedUrl`)
- [ ] RLS is enabled on: `profiles`, `family_members`, `member_access`, `categories`, `documents`
- [ ] Storage policies exist for SELECT, INSERT, UPDATE, DELETE on the `documents` bucket
- [ ] Anonymous users cannot read, upload, or delete any files
- [ ] Family members can only see documents for authorized family folders
- [ ] Family members cannot upload, delete, or rename documents
- [ ] Signed URLs are set to expire within 5 minutes
- [ ] Passwords are handled only by Supabase Auth (never stored in your database)
- [ ] No analytics or tracking services are included

---

## 📋 Supported File Types

| Type | Extensions |
|------|-----------|
| Images | `.jpg`, `.jpeg`, `.png`, `.webp` |
| Documents | `.pdf` |

**Maximum file size:** 50 MB per file

Images larger than 2048px are automatically compressed client-side before upload to save Supabase storage quota.

---

## 💾 Supabase Free Plan Limits

| Resource | Free Limit |
|----------|-----------|
| File Storage | 1 GB |
| Database | 500 MB |
| Bandwidth | 5 GB/month |
| Monthly Active Users | 50,000 |
| Projects | 2 |

A typical family with ~500 documents averaging 1 MB each would use approximately 500 MB of storage — well within the free tier.

---

## 🗂️ Default Document Categories

The app ships with these pre-seeded categories:

- 🪪 **Identity** — Aadhaar, PAN, Passport, etc.
- 🎓 **Education** — Marksheets, Degrees, College IDs
- 🚗 **Vehicle** — RC Book, Insurance, Driving License
- 🛡️ **Insurance** — Health, Life, Car policies
- 🏠 **Property** — Deeds, Registry, Utility Bills
- 💰 **Financial** — Tax returns, Bank documents, Investments
- 📄 **Other** — Miscellaneous important documents

Admins can add custom categories from the Settings page.

---

## 📱 Mobile Support

The application is fully responsive:
- Large touch-friendly buttons and targets
- Horizontal category scroll tabs on mobile
- Collapsible sidebar navigation on small screens
- Mobile-optimized document cards and grids

---

## 🛠️ Troubleshooting

**Setup screen appears even after entering credentials:**
→ Verify there are no typos in `js/supabase.js`. The URL should start with `https://` and the key should be a long JWT string starting with `eyJ`.

**Login fails with "Invalid login credentials":**
→ Ensure the user exists in Supabase Auth (check Authentication → Users in Supabase dashboard).

**No documents appearing after upload:**
→ Check that RLS policies were applied correctly. Run `supabase/rls.sql` again in the SQL editor.

**"Access Denied" when viewing a document:**
→ Ensure the Storage policies from `supabase/storage-policies.sql` were run successfully.

**First user is not Admin:**
→ Check if the `handle_new_user` trigger was created by running `schema.sql`. Manually update via SQL: `UPDATE public.profiles SET role='admin' WHERE email='your@email.com';`

---

## 📜 Privacy

- No analytics or tracking.
- No third-party image processing.
- No external AI document services.
- All documents remain inside your private Supabase Storage bucket.
- Signed URLs are temporary and expire automatically.

---

*Built for private family use. Keep your documents safe.* 🔐
