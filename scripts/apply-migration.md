# Apply Supabase Migration

To apply the database schema to your Supabase cloud instance:

1. Go to your Supabase Dashboard: https://app.supabase.com/project/ylgylxezhqizrscpcsqu
2. Navigate to **SQL Editor** in the left sidebar
3. Copy and paste the contents of `/supabase/migrations/20250820000001_initial_schema.sql`
4. Click **Run** to execute the migration

## What this migration creates:

- **7 main tables**: tournaments, players, teams, team_members, courts, matches, match_games
- **Custom enums** for type safety
- **Proper relationships** with foreign keys
- **Performance indexes** on frequently queried columns
- **Triggers** for auto-updating timestamps and player counts
- **Row Level Security** enabled (with permissive policies for now)

## After running the migration:

The database will be ready for the new Supabase-based data layer. All existing server actions will be updated to use PostgreSQL instead of JSON files.

## Verification:

After running the migration, you should see all tables in the **Table Editor** section of your Supabase dashboard.