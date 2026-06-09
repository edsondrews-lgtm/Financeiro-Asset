import { createClient } from '@supabase/supabase-js'

const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  'https://fgtesjnvjfeeyzvwgtpx.supabase.co'

const supabaseAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  'sb_publishable_6f33G7R-ayx5SHNSMNSSmQ_tuNBienE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
