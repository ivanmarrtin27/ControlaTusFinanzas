# ControlaTusFinanzas

App web personal de finanzas (español). Stack: **Vite + React + TypeScript + Supabase**.  
Diseño **Green Deck** (sin paywalls, sin hogares compartidos). Hosting: **Vercel** (Hobby / gratis).

## Enlaces

| | |
|---|---|
| **App en vivo** | https://controlatusfinanzas.vercel.app |
| **Código (GitHub)** | https://github.com/ivanmarrtin27/ControlaTusFinanzas |

## URL pública

**https://controlatusfinanzas.vercel.app**

Cualquiera puede abrir esa URL, crear cuenta (email/contraseña) y usar la app **sin pagar**.  
El hosting en Vercel Hobby es gratis; el backend es el proyecto Supabase Free (límites de cuota del plan gratis: OK para amigos/familia o uso público ligero). No hay paywall en la app.

## Estado Supabase

Conectado al proyecto **ivanmarrtin2703's Project** (`zvxhndvvslsdgbfjlqms`, región `eu-west-1`).  
Schema + RLS + `replace_user_backup` + emergency fund + goals deadline + FK RLS aplicados.  
`.env` local con `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (no se versiona).  
En Vercel: mismas variables `VITE_*` en Production / Preview / Development (solo **anon**; nunca `service_role`).

## Requisitos

- Node.js 20+ (recomendado)
- Cuenta [Supabase](https://supabase.com)
- (Opcional) Google Cloud OAuth para login con Google

## Arranque local

```bash
cp .env.example .env
# Edita .env con URL y anon key de Supabase (ya rellenado si usas el proyecto de arriba)

npm install
npm run dev
```

Abre la URL que muestre Vite (normalmente `http://localhost:5173`). Tras cambiar `.env`, reinicia Vite.

Sin `.env` válido la UI carga en modo local/demo (auth deshabilitada, rutas accesibles para revisar el shell).

### Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run preview` | Previsualiza el build |
| `npm run lint` | Oxlint |

## Supabase

### 1. Crear / activar proyecto

1. Crea un proyecto en [Supabase Dashboard](https://supabase.com/dashboard) (región UE recomendada, p. ej. `eu-west-1`).
2. **Project Settings → API**: copia `Project URL` y la clave **anon / publishable** a `.env`.

### 2. Aplicar migraciones

Migraciones en `supabase/migrations/` (en orden):

1. `20261107113647_initial_schema.sql` — schema + RLS + categorías semilla
2. `20261107123451_goals_deadline.sql` — `goals.deadline`
3. `20261107140000_emergency_fund_target.sql` — `profiles.emergency_fund_target`
4. `20261107152000_replace_user_backup.sql` — RPC atómica de importación JSON (fase 5)
5. `20261107160000_rls_fk_ownership.sql` — endurece RLS: FKs solo a filas del propio usuario (fase 6)
6. `20261107180000_v11_tags_and_debt_due_date.sql` — etiquetas + `debts.due_date`
7. `20261107190000_replace_user_backup_v2_tags.sql` — RPC backup v2 con tags

**Opción A — SQL Editor (rápida)**  
Dashboard → SQL → New query → pega cada archivo en orden → Run.

**Opción B — CLI**

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

### 3. Auth email / password + URLs (manual, 1 minuto)

Email ya viene habilitado. Haz estos clics en el [Dashboard](https://supabase.com/dashboard/project/zvxhndvvslsdgbfjlqms/auth/url-configuration) (la API MCP no puede cambiar Auth URLs):

1. **Authentication → URL Configuration**
   - **Site URL:** `https://controlatusfinanzas.vercel.app` (producción; para uso público)
   - **Redirect URLs** (añade todas):
     - `https://controlatusfinanzas.vercel.app/**`
     - `http://localhost:5173/**`
     - `http://127.0.0.1:5173/**`
2. **Authentication → Providers → Email**
   - Activa **Enable Sign in with Email** (si está apagado, registro y login fallan con `email_provider_disabled`).
   - Desactiva **Confirm email** para que cualquiera se registre al instante sin SMTP (en Free el correo de confirmación a menudo no llega).  
   - Si más adelante configuras SMTP propio, puedes volver a activarlo.
   - Nota: la app incluye un fallback (`auth-email` Edge Function) para registrar/entrar aunque el proveedor Email esté temporalmente desactivado.

### 4. Google OAuth (opcional; no bloquea email)

Todavía no hay Client ID/Secret en este proyecto. Para activarlo:

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth → tipo **Aplicación web**.
2. Orígenes JavaScript autorizados: `http://localhost:5173`
3. URI de redirección autorizados: `https://zvxhndvvslsdgbfjlqms.supabase.co/auth/v1/callback`
4. Copia Client ID y Secret → Supabase **Authentication → Providers → Google → Enable** → pegar → Save.

### 5. Advisors (recomendado)

Tras aplicar el schema, revisa Database → Advisors (seguridad / rendimiento) y corrige avisos si aparecen.

### Checklist RLS (fase 6)

Antes de producción, verifica:

- [ ] Todas las tablas de negocio tienen RLS **activado**
- [ ] Policies usan `(select auth.uid()) = user_id` (o equivalente) en SELECT/INSERT/UPDATE/DELETE
- [ ] No hay grants de escritura a `anon` sobre tablas de negocio
- [ ] El cliente solo usa la clave **anon**; nunca `service_role` en el front
- [ ] Aplicada `20261107160000_rls_fk_ownership.sql` (movimientos/transferencias/presupuestos/recurrentes/aportaciones/pagos de deuda no pueden apuntar a cuentas/categorías/objetivos ajenos)
- [ ] RPC `replace_user_backup` es `security definer`, comprueba `auth.uid()`, y solo está granted a `authenticated`
- [ ] Database → Advisors sin hallazgos críticos de seguridad

## Vercel — publicar

El repo incluye `vercel.json` con rewrites SPA → `index.html` (rutas como `/movimientos` no 404 al refrescar).

**Producción actual:** https://controlatusfinanzas.vercel.app  
Proyecto Vercel: `controlatusfinanzas` (Hobby). Deployment Protection / Vercel Authentication **desactivado** para acceso público.

### Variables de entorno (Vercel)

| Variable | Origen |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Misma página → anon / publishable key |

Ya están en el proyecto Vercel (Production + Preview + Development). No subas `.env` ni claves `service_role`.

### Auth redirect en producción

Ver sección **Auth email / password + URLs** arriba (Site URL = producción + redirects localhost).

Si usas Google OAuth, añade el origen `https://controlatusfinanzas.vercel.app` en Google Cloud → Authorized JavaScript origins / redirect según el flujo de Supabase.

### Redeploy desde CLI (sin Git)

```bash
npx vercel login
npx vercel deploy --prod
```

(El directorio ya está linkado a `controlatusfinanzas`. Las `VITE_*` están en el proyecto.)

### Pasos de deploy (alternativa vía Git)

1. Sube el proyecto a un remoto Git (GitHub/GitLab/Bitbucket) si aún no lo tienes.
2. En [Vercel](https://vercel.com): conecta el repo al proyecto existente o importa de nuevo.
3. Framework preset: **Vite** · Build: `npm run build` · Output: `dist`.
4. Confirma `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Deploy y verifica Auth URLs en Supabase.

## Checklist «Go live»

1. [x] Proyecto Supabase **activo** (no INACTIVE / paused)
2. [x] Las **5 migraciones** aplicadas en orden
3. [ ] Auth email: Site URL + Redirect URLs de producción en Dashboard (+ Google si lo usas)
4. [ ] **Confirm email** desactivado (recomendado en Free sin SMTP)
5. [x] Variables `VITE_*` en Vercel (sin `service_role`)
6. [x] Deploy Vercel OK; deep-link `/movimientos` responde 200 (SPA rewrite)
7. [ ] Login, alta de cuenta, movimiento y cierre de sesión OK en la URL pública
8. [ ] Advisors RLS / checklist de arriba revisados

## Estructura

```
src/
  components/   # UI, shell, BackupPanel, PWA tips, formularios
  contexts/     # Auth
  hooks/        # useMoneyData, usePlanData, useVisibilityRefresh
  lib/          # supabase, backup, balances, moneyApi, analysis, accent…
  pages/        # Inicio, Movimientos, Ajustes, auth…
  styles/       # tokens Green Deck + layout
  types/        # Database types
public/icons/   # Iconos PWA / shortcuts
supabase/
  migrations/   # SQL versionado
vercel.json     # Rewrites SPA para Vercel
```

## Fases

| Fase | Estado |
|---|---|
| 0 Fundación (shell, tokens, rutas) | Hecha |
| 1 Auth + schema | Hecha (aplicar SQL en tu proyecto) |
| 2 Core dinero (cuentas, movimientos, transferencias) | Hecha |
| 3 Planificación | Hecha |
| 4 Análisis + centro financiero | Hecha |
| 5 PWA + backup JSON | Hecha (aplicar migración `replace_user_backup`) |
| 6 Ajustes pulidos + deploy | **Hecha** (aplicar migración RLS FK + deploy Vercel) |

## Copia de seguridad (fase 5)

En **Ajustes → Copia de seguridad** (requiere sesión + Supabase):

- **Exportar JSON** — descarga versionada (`version: 2`) con cuentas, categorías, movimientos, transferencias, presupuestos, recurrentes, objetivos, aportaciones, deudas, pagos, **etiquetas** (`tags` + `transaction_tags`) y preferencias de perfil. Sin contraseñas. Las copias `version: 1` siguen siendo importables (etiquetas vacías).
- **Importar** — estrategia **replace** (sustituye los datos del usuario para esas entidades). Hay que escribir `SUSTITUIR` para confirmar. Preferible la RPC `replace_user_backup` actualizada en `supabase/migrations/20261107190000_replace_user_backup_v2_tags.sql`; si falta, la app usa un fallback cliente secuencial.

## Informes

En **Más → Informes** (sesión + datos Supabase): elige periodo y descarga **Excel (.xlsx)** multihoja o **PDF** multi-sección. CSV e imprimir quedan como opciones secundarias. Sin paywall.

## PWA e atajos

- Build con `vite-plugin-pwa` (manifest + service worker). Instalable desde el navegador (móvil/desktop).
- Atajos del manifest: `/?quick=expense` y `/?quick=income` → redirigen a Movimientos con el sheet de alta.
- Equivalente ya existente: `/movimientos?nuevo=1&quick=expense|income`.
- En iPhone PWA: tras un deploy, un refresh suele bastar para cargar las nuevas funciones JS (Excel/PDF).

Para probar PWA en local: `npm run build` + `npm run preview` (el SW no se activa en `dev` por defecto).

## Moneda

Por defecto **EUR** en `profiles.currency`. Selector en **Ajustes** (lista fija: EUR, USD, GBP, MXN, ARS, COP, CLP, CHF). **No hay tipos de cambio** ni conversión automática.

## Color de acento

Presets Green Deck + hex libre en Ajustes. Se aplica en vivo a `--accent` / `--accent-hover` / `--text-on-accent` (y variantes soft). Persistencia en `profiles.accent_color` + `localStorage` para first paint. Si el acento es demasiado oscuro o poco contrastado, la UI muestra un aviso.

## Saldos (fase 2)

El saldo de cada cuenta es **derivado** (no hay columna `current_balance`):

`opening_balance + sum(ingresos) − sum(gastos) − salidas de transferencia + entradas de transferencia`

Las transferencias viven en la tabla `transfers` y **no** se registran como ingresos/gastos, así el patrimonio no se duplica.

## Probar core dinero

1. Activa el proyecto Supabase si está en pausa (Dashboard → Restore).
2. Aplica las migraciones de `supabase/migrations/` en orden si aún no están.
3. Configura `.env`, `npm run dev`, inicia sesión.
4. Crea una cuenta → registra un ingreso/gasto (FAB o Movimientos) → transfiere entre dos cuentas → revisa saldos en Cuentas e Inicio.

**Nota:** si el proyecto aparece como `INACTIVE` en el dashboard/MCP, la UI arranca pero las mutaciones fallarán hasta restaurarlo.
