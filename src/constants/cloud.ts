/**
 * Supabase project for multi-device sync. The anon key is public by design
 * (it ships in every app build); real access control is the login + RLS in
 * supabase/schema.sql. NEVER put the service_role key here.
 */
export const CLOUD_URL = "https://anbdunsxygdzwcbmcyru.supabase.co";
export const CLOUD_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuYmR1bnN4eWdkendjYm1jeXJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NTQxMzksImV4cCI6MjEwNzQzMDEzOX0.7SU-o55pvaQOsN-eEyo9x7ufTGYoaQvYKUAjejHHf-U";
