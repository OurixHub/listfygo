import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cssojhjqjincqgfxcoxa.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNzc29qaGpxamluY3FnZnhjb3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0MTkyNjgsImV4cCI6MjA5NDk5NTI2OH0.9XMQ45jv7PVohqOKBRb8OJlAri13cP5BCaboAI8PSaM';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

