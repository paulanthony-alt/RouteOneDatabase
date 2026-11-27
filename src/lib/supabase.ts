import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

// A placeholder client keeps imports safe when env vars are missing; App shows a setup notice instead.
export const supabase = createClient(url || 'http://localhost:54321', key || 'missing-anon-key');
