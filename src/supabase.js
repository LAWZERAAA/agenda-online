import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variáveis de ambiente ausentes. ' +
    'Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (dev) e na Vercel (prod).'
  );
}

// Mesmo se faltarem, tentamos criar o client para evitar travar import.
// Operações Supabase vão dar erro depois, mas o restante da UI não quebra.
export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseAnonKey || 'anon');