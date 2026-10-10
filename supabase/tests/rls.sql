-- Smoke RLS checks intended for a local Supabase test database.
-- These are documentation-grade until wired into CI with Supabase CLI.
begin;

-- Campaign private source text should not be visible to sibling campaign members.
-- World public lore should be visible to authorized descendants.
-- Generated outputs are not acceptable claim evidence.

rollback;
