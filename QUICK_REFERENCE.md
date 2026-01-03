# Quick Reference - Supabase Commands

## Important: Command Syntax

When using Supabase CLI through npm scripts, you **must** use `--` to pass arguments:

```bash
# ✅ CORRECT
npm run supabase link -- --project-ref ccvxxtkwfdxtoigkumfx

# ❌ WRONG (won't work)
npm run supabase link --project-ref ccvxxtkwfdxtoigkumfx
```

The `--` tells npm to pass everything after it directly to the supabase command.

## Common Commands

### Authentication
```bash
# Login to Supabase (required before linking)
npm run supabase login
```

### Project Linking
```bash
# Link your project (from root directory)
# Use npx directly - it handles arguments better than npm run
npx supabase link --project-ref <your-project-ref>

# Example:
npx supabase link --project-ref ccvxxtkwfdxtoigkumfx
```

### Local Development (Optional - for later)
```bash
# Initialize Supabase locally
npm run supabase init

# Start local Supabase stack
npm run supabase start

# Stop local Supabase stack
npm run supabase stop
```

### Migrations (Phase 1+)
```bash
# Create a new migration
npm run supabase migration new <migration-name>

# Apply migrations
npm run supabase db push
```

## Where to Run Commands

**Always run Supabase CLI commands from the root directory** (`Pawie-Expo/`), not from `apps/admin/` or `apps/mobile/`.

## Getting Your Project Reference ID

1. Go to Supabase Dashboard
2. Select your project
3. Go to **Project Settings** → **General**
4. Copy the **Reference ID** (looks like: `ccvxxtkwfdxtoigkumfx`)

