# Esquema de base de datos

Los archivos de `migrations/` recogen **los cambios aplicados a partir de la auditoría
de septiembre de 2026**, en orden cronológico. Cada uno está aplicado ya en el proyecto
de producción (`ralolxpdifvnizpubuju`).

| Migración | Qué corrige |
|---|---|
| `20260913000001_fix_ai_rls_user_scoped.sql` | Las políticas de `ai_sessions` y `ai_plans` exigían plan `premium`; todo usuario real era rechazado al guardar. |
| `20260914000001_harden_entitlements.sql` | Cualquier usuario podía ascenderse a premium y emitirse su propia suscripción. Además, funciones `SECURITY DEFINER` con `search_path` abierto. |
| `20260914000002_schema_integrity.sql` | Clave foránea que faltaba en `tasks.project_id`, índice único en `habit_history`, y `tasks.due_date` migrada de `text` a `date`. |

## Falta el baseline

Estas migraciones son **deltas**: describen lo que cambió, no el esquema completo. Quien
clone el repositorio hoy todavía no puede recrear la base desde cero.

Para cerrar eso, captura el estado actual como migración inicial. Necesitas la contraseña
de la base de datos (Supabase → Project Settings → Database):

```bash
npx supabase link --project-ref ralolxpdifvnizpubuju
npx supabase db dump --schema public -f supabase/migrations/00000000000000_baseline.sql
```

A partir de ahí, la regla es simple: **todo cambio en la base de datos entra como archivo
en el mismo commit que el código que lo usa.** Que el esquema viviera solo dentro de
Supabase es la causa de fondo de la mitad de los hallazgos de la auditoría — desajustes
entre lo que el código suponía y lo que la base hacía, invisibles al revisar un cambio.

## Pendiente, solo desde el panel

No se puede hacer por SQL:

- **Protección de contraseñas filtradas** — Authentication → Policies. Contrasta cada
  contraseña nueva contra HaveIBeenPwned. Está desactivada.
- **Lista de URLs de redirección** — Authentication → URL Configuration. Debe ser una
  lista explícita de tus dominios reales, sin comodines tipo `https://*.vercel.app/**`.
