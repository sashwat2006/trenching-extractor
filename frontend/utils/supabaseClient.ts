import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lvntsgirawodnejpteax.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnRzZ2lyYXdvZG5lanB0ZWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4NTAwNjgsImV4cCI6MjA2NjQyNjA2OH0.pTFm2476J0HkjLWvjTiLrukhZTkS-1QAioLhhfApBbQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
