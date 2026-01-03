# Phase 0: Repository + Environment Baseline

**Goal**: Set up the development environment and repository structure for local development.

**Status**: ~98% Complete - Ready for final manual connection tests!

---

## Checklist

### 1. Repository Structure ✅

- [x] Create monorepo structure
  - [x] `apps/mobile/` (Expo app)
  - [x] `apps/admin/` (Next.js app)
  - [x] `supabase/migrations/` directory
  - [x] `docs/` directory
- [x] Create root `package.json` with workspace scripts
- [x] Create `pnpm-workspace.yaml`
- [x] Create root `.gitignore`
- [x] Update mobile app package name to `mobile`

**Current Structure:**
```
Pawie-Expo/
├── apps/
│   ├── mobile/          ✅ Expo app
│   └── admin/           ✅ Next.js app
├── supabase/
│   └── migrations/      ✅ Ready for migrations
├── docs/                ✅ Documentation
├── package.json         ✅ Root workspace config
├── pnpm-workspace.yaml  ✅ Workspace definition
└── .gitignore          ✅ Root gitignore
```

---

### 2. Required Tooling Installation

- [x] Install **pnpm** globally
  ```bash
  npm install -g pnpm
  ```
- [x] Install **Supabase CLI** ✅ (installed as dev dependency in root)
  ```bash
  # Installed in root package.json as dev dependency
  # Use: npm run supabase <command>
  # Or: npx supabase <command>
  ```
- [x] Verify **Node.js LTS** is installed ✅ (v22.16.0)
  ```bash
  node --version  # Should be >= 18.0.0
  ```
- [x] Verify **Git** is installed ✅ (v2.42.0)
  ```bash
  git --version
  ```
- [ ] Install **Expo CLI** (if not using npx)
  ```bash
  npm install -g expo-cli
  ```

---

### 3. Supabase Project Connection

- [x] Supabase project created manually (user confirmed)
- [ ] Login to Supabase CLI
  ```bash
  # From root directory
  npx supabase login
  # This will open a browser to authenticate
  ```
- [x] Link Supabase project to local repo ✅
  ```bash
  # From root directory - use npx directly (works better than npm run)
  npx supabase link --project-ref <your-project-ref>
  
  # Example:
  npx supabase link --project-ref ccvxxtkwfdxtoigkumfx
  ```
  
  **Note**: The "unknown config field" warnings are safe to ignore - they're just newer config options your CLI version doesn't recognize yet.
- [x] Initialize Supabase locally (optional, for local development later)
  ```bash
  npm run supabase init
  ```
- [x] Pull remote schema - **SKIP** (no schema exists yet, will create in Phase 1)

**Note**: 
- You must run `supabase login` first to get an access token
- The `--` is needed to pass arguments through npm scripts
- Linking connects your local repo to the remote Supabase project for migrations

---

### 4. Environment Variables Setup

#### 4.1 Admin App (`apps/admin/`)

- [x] Create `.env.local` file ✅ (user confirmed)
  ```bash
  # Supabase Configuration
  # Get from: Supabase Dashboard → Project Settings → API
  NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
  ```

#### 4.2 Mobile App (`apps/mobile/`)

- [x] Create `.env.local` file ✅ (user confirmed)
  ```bash
  # Supabase Configuration
  # Get from: Supabase Dashboard → Project Settings → API
  EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
  EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
  ```

#### 4.3 Root Level (if needed)

- [x] Create setup instructions ✅ (SETUP_INSTRUCTIONS.md)
- [x] Ensure `.env*.local` is in `.gitignore` ✅ (already done)

---

### 5. Install Dependencies

- [x] Install root dependencies
  ```bash
  pnpm install
  ```
- [x] Verify mobile app dependencies ✅ (Supabase client installed)
  ```bash
  cd apps/mobile
  pnpm install
  ```
- [x] Verify admin app dependencies ✅ (Supabase client installed)
  ```bash
  cd apps/admin
  pnpm install
  ```

---

### 6. Supabase Client Setup

#### 6.1 Admin App

- [x] Install Supabase client library ✅
  ```bash
  cd apps/admin
  pnpm add @supabase/supabase-js
  ```
- [x] Create Supabase client utility ✅
  - [x] Create `apps/admin/lib/supabase.ts` ✅
  - [x] Initialize Supabase client with env variables ✅

#### 6.2 Mobile App

- [x] Install Supabase client library ✅
  ```bash
  cd apps/mobile
  pnpm add @supabase/supabase-js
  ```
- [x] Create Supabase client utility ✅
  - [x] Create `apps/mobile/lib/supabase.ts` ✅
  - [x] Initialize Supabase client with env variables ✅

---

### 7. Basic Connection Test

- [x] Test admin app connection ✅
  ```bash
  cd apps/admin
  npm run dev
  ```
  - [x] Verify app starts without errors ✅
  - [x] Test Supabase connection page created ✅ (`/test-supabase`)
  - [ ] **Manual test**: Visit `http://localhost:3000/test-supabase` to verify connection

- [x] Test mobile app connection ✅
  ```bash
  cd apps/mobile
  npm start
  ```
  - [x] Verify app starts without errors ✅
  - [x] Test Supabase connection screen created ✅ (`/test-supabase`)
  - [ ] **Manual test**: Navigate to `/test-supabase` route in the app to verify connection

---

### 8. Supabase Configuration

#### 8.1 Authentication Setup

- [x] Enable email/password authentication in Supabase dashboard ✅
  1. Go to Supabase Dashboard → **Authentication** → **Providers**
  2. Find **"Email"** provider in the list
  3. Ensure the toggle is **enabled** (should be green/on)
  4. Configure email templates if needed (optional for now)
  5. Click **"Save"**

#### 8.2 Redirect URLs Configuration

- [x] Configure redirect URLs for admin app ✅
  1. Go to Supabase Dashboard → **Authentication** → **URL Configuration**
  2. Set **Site URL**: `http://localhost:3000`
  3. Add to **Redirect URLs** (one per line):
     ```
     http://localhost:3000/auth/callback
     http://localhost:3000/**
     ```
  4. Click **"Save"**

- [x] Configure redirect URLs for mobile app ✅
  1. In the same **URL Configuration** section
  2. Add to **Redirect URLs** (append to existing):
     ```
     exp://localhost:8081
     exp://localhost:8081/**
     pawie://**
     com.nchairna.appPawie://**
     ```
  3. Click **"Save"**

**Note**: The `**` wildcard allows all paths under that scheme/domain.

#### 8.3 Storage Bucket Creation

- [x] Create `product-images` storage bucket ✅
  1. Go to Supabase Dashboard → **Storage**
  2. Click **"New bucket"** button (top right)
  3. Configure the bucket:
     - **Name**: `product-images` (exact name, lowercase, no spaces)
     - **Public bucket**: ✅ **Enable** (check this box)
       - This allows public read access to product images
       - Customers need to view product images without authentication
     - **File size limit**: `5242880` (5MB in bytes) or your preferred limit
     - **Allowed MIME types**: 
       ```
       image/jpeg
       image/png
       image/webp
       image/gif
       ```
       - Click **"Add MIME type"** for each one
  4. Click **"Create bucket"**

- [x] Set up Storage Policies (RLS for storage) ✅
  
  **Step 1: Public Read Policy** ✅
  1. After creating the bucket, go to **Storage** → `product-images` → **Policies** tab
  2. Click **"New policy"** → **"Create policy from scratch"**
  3. Configure:
     - **Policy name**: `Public read access`
     - **Allowed operation**: Select **"SELECT"** (read)
     - **Target roles**: Select **"public"** (or **"anon"**)
     - **Policy definition**: 
       ```sql
       true
       ```
       - This allows anyone to read files from the bucket
  4. Click **"Review"** → **"Save policy"**
  
  **Your policy is correct!** ✅
  ```sql
  CREATE POLICY "Public read access 16wiy3a_0" ON storage.objects FOR SELECT TO anon USING (true);
  ```

  **Step 2: Admin Write Policy** ⏸️ **Deferred to Phase 1**
  
  **Note**: The admin write policy requires the `profiles` table with `role` column, which we'll create in Phase 1. We'll create the proper admin-only write policy in Phase 1 after the `profiles` table exists.

**Important Notes**:
- Storage policies use Row Level Security (RLS) similar to database tables
- The admin write policy will be properly configured in Phase 1 when `profiles` table exists
- For MVP, public read is sufficient for product images
- You can always update policies later in the Supabase dashboard

---

### 9. Git Setup Verification

- [ ] Verify `.gitignore` is working
  - [ ] Check that `node_modules/` is ignored
  - [ ] Check that `.env*.local` files are ignored
- [ ] Initial commit (if not done)
  ```bash
  git add .
  git commit -m "Phase 0: Repository structure and environment setup"
  ```

---

### 10. Documentation

- [x] Update root `README.md` with: ✅
  - [x] Project structure overview ✅
  - [x] Setup instructions ✅
  - [x] How to run each app ✅
  - [x] Environment variables needed ✅
- [x] Create `SETUP_INSTRUCTIONS.md` ✅

---

## Next Steps After Phase 0

Once Phase 0 is complete, proceed to:
- **Phase 1**: Database schema + RLS baseline
  - Create migrations for all tables
  - Set up Row Level Security policies
  - Create seed data script

---

## Notes

- **Supabase Project**: You mentioned you already created the Supabase project. We need to link it and configure the connection.
- **Environment Variables**: Never commit actual keys to git. Use `.env.local` files locally.
- **pnpm**: The document requires pnpm, but you can use npm temporarily if needed. However, pnpm is recommended for monorepo management.

---

## Verification

Phase 0 is complete when:
- ✅ Monorepo structure is correct
- ✅ All tooling is installed
- ✅ Supabase project is linked
- ✅ Environment variables are configured
- ✅ Both apps can start and connect to Supabase
- ✅ Dependencies are installed
- ✅ Git is properly configured

