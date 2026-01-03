# Pawie Setup Instructions

## Environment Variables

### Admin App (`apps/admin/`)

Create a `.env.local` file in `apps/admin/` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Mobile App (`apps/mobile/`)

Create a `.env.local` file in `apps/mobile/` with:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: For Expo, you can also configure these in `app.json` under the `extra` section, but using `.env.local` is recommended.

## Getting Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** > **API**
3. Copy:
   - **Project URL** → Use for `*_SUPABASE_URL`
   - **anon/public key** → Use for `*_SUPABASE_ANON_KEY`

**Important**: Never commit `.env.local` files to git. They are already in `.gitignore`.

## Linking Supabase Project

Supabase CLI is installed as a dev dependency in the root. To link your project:

### Step 1: Login to Supabase CLI

```bash
# From root directory
npx supabase login

# This will open your browser to authenticate
# After login, you'll get an access token stored locally
```

### Step 2: Link Your Project

```bash
# Get your project reference ID from Supabase dashboard
# Project Settings > General > Reference ID

# Link your project (use npx directly - works better than npm run)
npx supabase link --project-ref <your-project-ref>

# Example:
npx supabase link --project-ref ccvxxtkwfdxtoigkumfx
```

**Important**: 
- You **must** run `supabase login` first (if not already logged in)
- Use `npx` directly instead of `npm run` for better argument handling
- Run this from the **root directory** (not from apps/)
- The "unknown config field" warnings are safe to ignore

## Running the Apps

### Admin App
```bash
cd apps/admin
pnpm dev
# or
npm run dev
```

### Mobile App
```bash
cd apps/mobile
pnpm start
# or
npm start
```

