# Esquema de base de datos

Los archivos de `migrations/` recogen **los cambios aplicados a partir de la auditoría
de septiembre de 2026**, en orden cronológico. Todos están aplicados ya en el proyecto
de producción (`ralolxpdifvnizpubuju`).

| Migración | Qué hace |
|---|---|
| `20260913000001_fix_ai_rls_user_scoped.sql` | Las políticas de `ai_sessions` y `ai_plans` exigían plan `premium`; todo usuario real era rechazado al guardar. |
| `20260914000001_harden_entitlements.sql` | Cualquier usuario podía ascenderse a premium y emitirse su propia suscripción. Además, funciones `SECURITY DEFINER` con `search_path` abierto. |
| `20260914000002_schema_integrity.sql` | Clave foránea que faltaba en `tasks.project_id`, índice único en `habit_history`, y `tasks.due_date` migrada de `text` a `date`. |
| `20260914000003_okrs.sql` | Tabla `objectives` y `goals.objective_id`: un objetivo cualitativo con resultados clave medibles colgando. Añade `direction` y `start_value` para medir resultados que bajan. |
| `20260914000004_google_calendar_sync.sql` | Tabla `google_credentials` y columnas de mapeo en `calendar_events` para la sincronización con Google. |
| `20260914000005_google_sync_functions.sql` | Las tres funciones que hacen la sincronización correcta. Ver abajo por qué son necesarias. |

## Por qué la sincronización vive en funciones SQL

Dos problemas que no se pueden resolver desde el cliente:

**El bucle de reenvío.** `calendar_events` tiene un trigger que pone `updated_at = now()`
en cada escritura. Si la sincronización marcase `last_synced_at` con una marca de tiempo
calculada en JavaScript, el trigger dejaría `updated_at` posterior y el evento parecería
«editado después de sincronizar» para siempre: se reenviaría a Google en cada pasada, sin
fin. Dentro de una función, `now()` es el instante de la transacción, así que el trigger y
la columna coinciden exactamente y la comparación da falso.

**La detección de ediciones locales.** PostgREST no sabe comparar dos columnas entre sí en
un filtro, y `updated_at > last_synced_at` es justo la condición que identifica un evento
editado aquí y pendiente de subir. Sin `sync_pending_events`, una edición local a un evento
ya sincronizado no se enviaba nunca a Google.

Las tres funciones están verificadas contra producción: un evento nuevo entra en la cola,
deja de estar pendiente al subirlo, vuelve a la cola si lo editas, y Google no pisa una
edición local más reciente.

## Variables de entorno

Ninguna de estas lleva el prefijo `VITE_`: ese prefijo hace que Vite las incruste en el
JavaScript que descarga cualquier visitante.

| Variable | Para qué | Dónde encontrarla |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Canjear el refresh token de Google | Google Cloud → APIs y servicios → Credenciales (las mismas del login) |
| `GOOGLE_CLIENT_SECRET` | Íd. | Íd. |
| `SUPABASE_SERVICE_ROLE_KEY` | Leer el `refresh_token`, deliberadamente fuera del alcance del rol `authenticated` | Supabase → Project Settings → API → `service_role` |

`SUPABASE_SERVICE_ROLE_KEY` salta todas las políticas RLS. Solo en el servidor, y cada
consulta de la función filtra por `user_id` explícitamente porque RLS ya no protege.

## En Google Cloud

1. **APIs y servicios → Biblioteca → Google Calendar API → Habilitar.**
2. **Pantalla de consentimiento OAuth → Ámbitos → Añadir** `https://www.googleapis.com/auth/calendar`.
3. Google clasifica ese ámbito como *sensible*. Con la app sin verificar solo funciona para
   las cuentas listadas en **Usuarios de prueba**, y muestra una pantalla de advertencia al
   dar permiso. Para uso personal basta; verificarla solo hace falta si la abres al público.

## Falta el baseline

Estas migraciones son **deltas**: describen lo que cambió, no el esquema completo. Quien
clone el repositorio hoy todavía no puede recrear la base desde cero. Para cerrarlo,
necesitas la contraseña de la base (Supabase → Project Settings → Database):

```bash
npx supabase link --project-ref ralolxpdifvnizpubuju
npx supabase db dump --schema public -f supabase/migrations/00000000000000_baseline.sql
```

A partir de ahí, la regla es simple: **todo cambio en la base de datos entra como archivo
en el mismo commit que el código que lo usa.** Que el esquema viviera solo dentro de
Supabase es la causa de fondo de la mitad de los hallazgos de la auditoría.

## Pendiente, solo desde el panel

- **Protección de contraseñas filtradas** — Authentication → Policies.
- **Lista de URLs de redirección** — Authentication → URL Configuration. Debe ser una lista
  explícita de tus dominios reales, sin comodines tipo `https://*.vercel.app/**`.
