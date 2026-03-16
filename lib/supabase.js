import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://nuliaposcgnctmwxvkot.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_i4shgXc2A2N34iGezPiYUg_kQ0R_jNm';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
