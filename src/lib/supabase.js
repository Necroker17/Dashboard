import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sin las variables, createClient lanza en tiempo de módulo — antes de que React
// monte — y el usuario veía una página en blanco sin ninguna explicación.
export const missingEnv = !supabaseUrl || !supabaseAnonKey

if (missingEnv) {
  console.error(
    'Faltan variables de entorno de Supabase: VITE_SUPABASE_URL y/o VITE_SUPABASE_ANON_KEY'
  )
}

// Valores de relleno para que el módulo cargue; App muestra el aviso.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
)

export const getUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
