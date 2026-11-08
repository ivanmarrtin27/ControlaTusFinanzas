# Plan de implementación — ControlaTusFinanzas

**Estado:** fases **0–6 implementadas** (v1 completa en el repo). Aplicar migraciones SQL en tu proyecto Supabase; proyecto remoto puede estar INACTIVE. Deploy: preparar Vercel (ver README).  
**Referencia funcional (no visual/copyright):** [controlfinancieroapp.es](https://controlfinancieroapp.es/)  
**Diseño:** Green Deck (DM Sans / JetBrains Mono, dark Spotify-like, acento verde configurable).

---

## Decisiones cerradas (registro)

| Tema | Decisión |
|---|---|
| Hosting front | **Vercel** |
| Moneda | **EUR por defecto** + selector en perfil (`profiles.currency`); **sin FX / sin conversión** |
| Atajos Apple Shortcuts | **Aplazados** (fuera de v1; PWA shortcuts en fase 5) |
| Stack | Vite + React + TypeScript + Supabase |
| Auth | Email/password + Google |
| Idioma | Español only |
| Paywall | Ninguno |

---

## 1. Hallazgos de la web de referencia

### Qué es técnicamente
- PWA web (`manifest.webmanifest`, tema `#0A0D09`), SPA detrás de un *account gate*.
- Stack aparente: React + Vite/RSC (`vinext`), **Supabase** (sesión/auth), **Stripe** (billing).
- Descripción pública: *“Registra tus ingresos y gastos y entiende tu dinero desde cualquier dispositivo.”*
- Manifest: *“Controla ingresos, gastos, presupuestos y pagos recurrentes desde cualquier dispositivo.”*
- Atajos PWA: `/?quick=expense` y `/?quick=income`.
- Rutas públicas detectadas: `/`, `/condiciones`, `/privacidad` (el resto de UI es *views* cliente en `/`).
- **Casi toda la app útil está detrás de login / paywall**; el modo gratuito es exploración con **datos de ejemplo en solo lectura**.

### Modelo free vs premium (detectado)

| | Free / demo | Premium |
|---|---|---|
| Explorar UI con datos de ejemplo | Sí (solo lectura) | — |
| Crear/editar cuentas, categorías, movimientos, objetivos | No | Sí |
| Atajo Apple/Android para registrar sin abrir la app | No (reservado Premium) | Sí |
| Espacio personal sync | No (o bloqueado) | Sí |
| Copia/backup export-import | Ligado a acceso de pago | Sí |
| Precio | Exploración | Prueba 14 días → **2,95 €/mes** o **29,50 €/año** (Stripe) |

Mensaje clave de marketing interno: *“La versión gratuita sirve para explorar. Premium desbloquea tu espacio personal completo.”*

**Implicación para ControlaTusFinanzas:** lo que ellos venden como Premium será **todo gratuito y desbloqueado** en v1. Sin Stripe, sin paywalls, sin modo demo forzado.

### Inventario de pantallas / flujos (views cliente)

Navegación inferior principal:
1. **Inicio** (`home`) — patrimonio, balances, actividad, accesos a planificar.
2. **Movimientos** (`movements`) — listado, búsqueda/filtros, alta rápida ingreso/gasto.
3. **Análisis** (`analysis`) — comparación de periodos, evolución ingresos/gastos/categorías.

Otras pantallas (desde Inicio / Ajustes / Planificación):
- **Cuentas** + detalle de cuenta (saldo, movimientos, categorías asociadas).
- **Categorías** (activar/desactivar; historial conservado).
- **Objetivos** de ahorro (aportaciones desde cuenta, pausar, progreso).
- **Planificación** con pestañas: **Límites (presupuestos)**, **Recurrentes**, **Deudas**, **Importar**.
- **Centro financiero**: salud financiera, fondo de emergencia, previsión 30 días, copias.
- **Ajustes**: perfil, idioma/moneda (ellos: es/en), suscripción, atajos, PWA, backup, cerrar sesión.
- **Atajo** (Apple Shortcuts / Android) — flujo Premium en la referencia.

### Features detalladas detectadas

**Cuentas**
- Tipos: al menos *cuenta bancaria*, *otra*; UI habla de tarjeta/efectivo; color; saldo inicial/actual; activar/desactivar (hasta ~20 cuentas mencionadas); saldo actualizado por movimientos/transferencias.

**Movimientos**
- Ingreso / gasto; importe, concepto, cuenta, categoría, fecha; búsqueda por concepto/cuenta/categoría; filtros (cuenta, categoría, recurrentes); FAB / quick-add; transferencias entre cuentas (`/api/transfers`).

**Categorías**
- CRUD, icono/color implícito por UI, activar/desactivar sin borrar historial.

**Presupuestos / límites**
- Límites por categoría; “presupuesto usado”; “sin límites”.

**Recurrentes**
- Pagos/ingresos recurrentes; previsión próximos 30 días; “próximo pago previsto”.

**Objetivos**
- Meta de ahorro, aportación desde cuenta, estados activo/pausado/conseguido; CTA de objetivo 3 meses desde fondo de emergencia.

**Deudas**
- “Debo” / “Me deben”; buscar por nombre/persona; pendientes/saldadas; registrar devoluciones; vincular movimiento de cuenta.

**Análisis / patrimonio**
- Balance del mes, ingresos vs gastos, patrimonio total / “patrimonio real después de deudas”, comparación con periodo anterior.

**Centro financiero — 4 indicadores**
1. Tasa de ahorro (objetivo sugerido 20 %).
2. Colchón actual (meses; objetivo 3–6).
3. Cambio de gastos vs mes anterior.
4. Balance del mes.

Más: cálculo de fondo de emergencia (media 3 meses de gasto), previsión cobros/pagos 30 días, export/import backup JSON.

**Auth / sync (referencia)**
- Email + contraseña (signup con nombre, idioma, moneda); recuperar contraseña; confirmación por correo.
- **No se detectó Google OAuth** en el bundle analizado (nosotros sí lo añadiremos).
- Sync multi-dispositivo vía cuenta + APIs (`/api/sync`, `/api/bootstrap`).
- Backup: `/api/backup/export` y `/api/backup/import` (JSON; sin passwords ni credenciales de atajo).

**Fuera / no detectado con certeza**
- Conexión bancaria: **explícitamente no** (condiciones/privacidad).
- Open banking, IA de tickets, carteras compartidas, inversiones con precios de mercado: no aparecen como producto core.

### Incertidumbres (app tras login)
- Detalle exacto de campos de deuda/recurrentes (frecuencia, día del mes, etc.) solo parcialmente visible en strings.
- Reglas exactas de cálculo de patrimonio vs saldos en objetivos.
- UX visual concreta de cada pantalla (no clonaremos UI; solo funcionalidad).
- Posibles micro-features solo visibles con sesión Premium real.

---

## 2. Alcance v1 ControlaTusFinanzas

### Marca y principios
- Nombre: **ControlaTusFinanzas**
- Español únicamente
- 100 % gratis / sin paywalls / sin “demo bloqueada”
- Datos **privados por usuario** (RLS); **sin presupuestos/hogares compartidos** en v1
- Web responsive + excelente UX móvil (+ PWA instalable)
- Auth: **email/contraseña + Google**
- Backend: **Supabase**
- Sync multi-dispositivo + export/import backup

### Features v1 (todas desbloqueadas)

1. **Auth:** registro/login email+password, Google OAuth, recuperación de contraseña, sesión persistente.
2. **Onboarding corto:** moneda por defecto EUR, categorías semilla, primera cuenta opcional.
3. **Inicio:** patrimonio, balance del mes, ingresos/gastos, últimos movimientos, accesos rápidos.
4. **Movimientos:** CRUD ingreso/gasto, búsqueda y filtros, adjunto opcional de nota.
5. **Transferencias** entre cuentas (actualizan saldos; no cuentan como gasto/ingreso).
6. **Cuentas:** CRUD, tipos (bancaria / efectivo / tarjeta / otra), color, saldo inicial, activar/desactivar.
7. **Categorías:** CRUD ingresos/gastos, color/icono, activar/desactivar.
8. **Presupuestos (límites)** por categoría y mes, progreso visual.
9. **Recurrentes:** plantillas de ingreso/gasto con frecuencia; generación/registro asistido; listado próximos.
10. **Objetivos de ahorro:** meta, aportaciones desde cuenta, progreso, pausar/completar.
11. **Deudas:** debo / me deben, pagos, estado pendiente/saldada.
12. **Análisis:** gráficos periodo, por categoría, comparación mes anterior.
13. **Centro financiero:** 4 indicadores + fondo de emergencia + previsión 30 días.
14. **Ajustes:** perfil, color de acento + presets, preferencias (formato moneda), export/import JSON, cerrar sesión, eliminar cuenta (básico).
15. **PWA:** instalable; shortcuts “Registrar gasto/ingreso”.
16. **Diseño Green Deck** (ver §4).

### Fuera de alcance v1
- Paywalls / Stripe / trials.
- Presupuestos u hogares compartidos.
- Open banking / sync bancario.
- Atajos nativos Apple Shortcuts / Siri con credencial privada (complejo iOS; **aplazado**; Android deep-link PWA sí vía shortcuts del manifest en fase 5).
- Multi-idioma (solo ES).
- Inversiones con cotizaciones en vivo / cripto feeds.
- Escaneo IA de tickets.
- App nativa store (solo web/PWA).
- Clonar assets, copy literal o UI de controlfinancieroapp.es.

---

## 3. Arquitectura propuesta

### Frontend — **Vite + React + TypeScript** (recomendado)

**Por qué Vite y no Next (v1):**
- La app es **SPA autenticada** (como la referencia), no un sitio de marketing SEO-heavy.
- Mejor DX para UI densa móvil, formularios y estado cliente.
- PWA sencilla (`vite-plugin-pwa`).
- Supabase JS client + Auth es natural en SPA.

**Next.js** tendría sentido si más adelante quieres landing SEO + blog; se puede añadir o migrar después. Para v1, Vite reduce superficie.

Stack UI sugerido:
- React Router
- CSS variables + módulos/CSS (sin forzar Tailwind si choca con Green Deck; opcional Tailwind solo para layout utilitario)
- Recharts o Chart.js para análisis
- date-fns / Temporal ligero para periodos

### Backend — Supabase

**Auth**
- Email/password (confirmación email en prod).
- Google provider (redirect).
- Perfil en `profiles` vía trigger `on_auth_user_created`.

**Principios RLS**
- Toda tabla de negocio con `user_id uuid references auth.users`.
- Policies: `auth.uid() = user_id` para SELECT/INSERT/UPDATE/DELETE.
- Nunca autorizar con `user_metadata` editable; preferencias en tabla propia o `app_metadata` solo si hace falta roles.
- Vistas con `security_invoker` si se usan.
- Sin `service_role` en el cliente.

### Esquema outline (v1)

| Tabla | Rol |
|---|---|
| `profiles` | display_name, avatar, accent_color, currency (EUR), locale (`es`), created_at |
| `accounts` | name, type, color, opening_balance, is_active, user_id |
| `categories` | name, kind (income/expense), color, icon, is_active, user_id |
| `transactions` | account_id, category_id?, type (income/expense), amount, concept, occurred_at, is_cleared, recurring_id?, debt_id?, user_id |
| `transfers` | from_account_id, to_account_id, amount, concept, occurred_at, user_id *(o pair de transactions vinculadas)* |
| `budgets` | category_id, amount_limit, period_month (date), user_id |
| `recurring_rules` | type, amount, concept, account_id, category_id, frequency, next_occurrence, is_active, user_id |
| `goals` | name, target_amount, current_amount (o calculado), status, color, user_id |
| `goal_contributions` | goal_id, account_id, amount, occurred_at, transaction_id?, user_id |
| `debts` | direction (owe/owed), person_name, principal, remaining, status, user_id |
| `debt_payments` | debt_id, amount, occurred_at, transaction_id?, user_id |

Saldos: calcular por `opening_balance + sum(movimientos/transferencias)` (evitar doble fuente de verdad) o materializar con trigger; preferible **cálculo derivado** + índices.

### Sync + export/import
- **Sync:** refetch al foco/visibilidad (`useVisibilityRefresh`, debounce 15s) + mutaciones directas; etiqueta “última sync” en Inicio. Sin Realtime en v1.
- **Export:** JSON versionado `{ version: 2, exported_at, app, profile, accounts, categories, …, tags, transaction_tags }` descarga cliente (`src/lib/backup.ts`).
- **Import (estrategia replace):** aceptar `version` 1–2 (v1 sin etiquetas → arrays vacíos); confirmación tipando `SUSTITUIR`; RPC atómica `public.replace_user_backup(jsonb)` (migración v2 tags) o fallback cliente secuencial. Orden FK: borrar `transaction_tags` antes de movimientos/tags; reinsertar `tags` antes de `transaction_tags` (tras `transactions`). Actualiza preferencias de `profiles` (no borra la cuenta). Sin merge-by-id.
- Sin incluir secrets de auth.

### Theming
- Tokens CSS: `--bg`, `--surface`, `--surface-elevated`, `--border`, `--text`, `--text-muted`, `--accent`, `--accent-hover`, `--danger`, `--success`.
- `--accent` por defecto Green Deck `#1DB954`; el picker en Ajustes escribe accent en `profiles` + `localStorage` para first paint.
- Elevación por brillo de superficie (no glows dorados). Acentos verdes solo en interactivos; botones primary / FAB / estados activos usan `var(--accent)`.

---

## 4. Diseño Green Deck

Fuente: `green-deck-DESIGN.md` (attachments). Sistema activo (sustituye QuestUI).

### Principios visuales
- Dark-first: fondo `#121212`, surface `#181818`, elevated `#282828` / `#333333`, rail `#000000`. Texto blanco / `#A7A7A7` / `#B3B3B3`. Sin fondos claros en UI primaria.
- Tipografía: **DM Sans** (display + body), **JetBrains Mono** (importes).
- Primario `#1DB954`, hover `#1ED760`. Verde solo para acentos/interactivos — no rellenos grandes.
- Radios: pills (`9999px`) en botones/chips/FAB; `8px` en cards; `4px` en inputs.
- Contenedores sin borde: separación por color de superficie. Hover con scale ~1.04 en botones.

### Navegación móvil
- Bottom nav: **Inicio · Movimientos · + (FAB circular verde) · Análisis · Más/Ajustes**.
- Desktop: rail/sidebar 240px `#000` + brand “ControlaTusFinanzas”.
- Sheets inferiores para formularios de alta (móvil).

### Accent picker
- Presets Green Deck: Verde Deck, Lima, Menta, Azul eléctrico, Coral, Violeta.
- Color libre (input hex) usable sobre fondo oscuro.
- Persistencia en perfil (sync) + fallback local.

---

## 5. Fases de implementación

| Fase | Entregable | Esfuerzo | Estado |
|---|---|---|---|
| **0. Fundación** | Repo Vite/React/TS, tokens Green Deck, layout shell, routing | **S** | **Hecha** |
| **1. Supabase + Auth** | migrations+RLS, email+Google, login/registro/recover, `profiles` | **M** | **Hecha** (aplicar SQL remoto) |
| **2. Core dinero** | Cuentas, categorías semilla, movimientos, transferencias, Inicio con saldos reales | **L** | **Hecha** (UI + API cliente; requiere Supabase activo) |
| **3. Planificación** | Presupuestos, recurrentes, objetivos+aportaciones, deudas | **L** | **Hecha** (UI + API cliente; migración `goals.deadline`; requiere Supabase activo) |
| **4. Inteligencia** | Análisis/gráficos, Centro financiero (4 indicadores + emergencia + previsión 30d) | **M** | **Hecha** (UI + `lib/analysis`; migración `profiles.emergency_fund_target`) |
| **5. Datos y dispositivo** | Export/import JSON, sync polish, PWA shortcuts, onboarding | **M** | **Hecha** (UI + `backup.ts` + RPC `replace_user_backup`; PWA con `vite-plugin-pwa`) |
| **6. Ajustes y pulido** | Accent picker, vacíos/errores ES, accesibilidad móvil, hardening RLS, deploy Vercel | **M** | **Hecha** (`vercel.json`, migración RLS FK, checklist README) |

Orden estricto: no construir Análisis antes de movimientos reales; no backup antes del schema estable.

---

## 6. Skills encontradas

| Skill / recurso | Ruta | Uso previsto |
|---|---|---|
| **find-skills** | `C:\Users\FA506\.claude\skills\find-skills\SKILL.md` | Búsqueda de skills goclone/houdini |
| **Supabase** | `C:\Users\FA506\.cursor\plugins\cache\cursor-public\supabase\release_v0.1.4\skills\supabase\SKILL.md` | Auth, schema, RLS, MCP/docs al implementar |
| **Supabase Postgres best practices** | `...\skills\supabase-postgres-best-practices\SKILL.md` | Índices, RLS, diseño de queries |
| **Green Deck design** | attachments `green-deck-DESIGN.md` | Sistema visual activo |
| **QuestUI design** | attachments `questui-DESIGN.md` / `_1.md` | Histórico (sustituido) |
| **Skill goclone (análisis web)** | **No instalada / no existe** como skill Cursor útil | Análisis hecho vía WebFetch + inspección de HTML/JS/manifest/legal |
| **CLI goclone** (`goclone-dev/goclone`) | Mencionado en chat padre; Go/brew no disponibles aquí | No usado; no clonar sitio al proyecto (copyright) |
| **Houdini** | Solo skills de **SideFX Houdini (VFX 3D)** en skills.sh | **No aplicable** |
| Skills “clone-website” genéricas | Existen en el ecosistema | **No usar** para copiar el producto competidor |

---

## 7. Preguntas abiertas residuales — resueltas

1. **Hosting:** Vercel.
2. **Atajos Apple:** aplazados (solo PWA en fase 5).
3. **Moneda:** EUR default + selector en perfil, sin FX.

---

## v1.1 fases

Ampliación gratuita sobre v1. Orden estricto A→F. Diseño Green Deck, UI en español, RLS por usuario.

| Fase | Feature | Entregable | Estado |
|---|---|---|---|
| **A** | Etiquetas (6) | `tags` + `transaction_tags` (M2M), RLS, UI gestionar/asignar/filtrar | **Hecha** |
| **B** | Inicio enriquecido (8) | Widgets hoy/semana, atajos visibles, avisos compactos | **Hecha** |
| **C** | Calendario vencimientos (7) | Agenda/mes: recurrentes, deudas (`due_date`), deadlines de objetivos | **Hecha** |
| **D** | Recordatorios (1) | Centro in-app (feed derivado + dismiss localStorage), campana + badge; Notification API opcional | **Hecha** |
| **E** | Informes PDF/Excel (4) | Página Informes: periodo → `.xlsx` multihoja (exceljs) + PDF descargable (jspdf) + CSV/print secundarios | **Hecha** |
| **F** | Cuenta y privacidad (9) | Página Privacidad, flujo eliminar cuenta (Edge Function), enlaces en Ajustes | **Hecha** |

### Detalle por fase

**A — Etiquetas:** tablas `tags` (user_id, name, color) y `transaction_tags` (PK compuesta, índices FK). CRUD etiquetas (Más/Categorías o Ajustes ligero). Asignación multi-tag en alta/edición de movimiento. Filtro por etiqueta en Movimientos.

**B — Inicio:** resumen ingresos/gastos de hoy y de la semana; fila de atajos (gasto, ingreso, transferir, objetivos); bloque compacto de avisos (límites/recurrentes) sin dependencias nuevas.

**C — Calendario:** columna `debts.due_date`; página `/calendario` (nav Más + rail); vista mes + lista de próximos 30–60 días unificando recurrentes, deudas pendientes y objetivos con deadline.

**D — Recordatorios:** feed derivado (presupuesto ≥80 %, recurrentes ≤7 días, vencimientos próximos, inactividad N días). Dismiss en localStorage. Campana en top-bar con badge. Si el usuario concede permiso, `Notification` del navegador al cargar avisos nuevos.

**E — Informes:** selector de periodo; Descargar Excel (`.xlsx` multihoja: resumen, cuentas, movimientos, categorías) y Descargar PDF (jspdf + autotable, multi-sección). CSV e imprimir como secundarios. Entrada desde Más + ruta `/informes`.

**F — Privacidad / borrar cuenta:** `/privacidad` (texto honesto: datos en Supabase, sin venta, sin open banking). Confirmar tipando `ELIMINAR`; Edge Function con service role borra filas + `auth.users`; enlaces en Ajustes y pie de auth.

---

## v1.2 — Plantillas rápidas + fotos de tickets

| Feature | Entregable | Estado |
|---|---|---|
| **Plantillas rápidas** | Tabla `transaction_templates` + RLS; página `/plantillas`; chips en Inicio / Movimientos / sheet de alta para prefills | **Hecha** |
| **Fotos de tickets** | Columna `transactions.receipt_path`; bucket privado `receipts` (`{user_id}/{tx_id}/…`); upload cámara/galería, miniatura con signed URL, borrar | **Hecha** |
| **Backup** | Schema v3: plantillas + `receipt_path` (solo rutas). Las imágenes binarias **no** se incluyen en el JSON | **Hecha** |

Migración: `20261107193000_v12_templates_and_receipts.sql` (aplicar en remoto si no está).

---

## UX · Densidad y utilidad (post v1.2)

Green Deck se mantiene. Objetivo: más contenido útil por viewport en móvil, sin rediseñar marca.

| Fase | Enfoque | Estado |
|---|---|---|
| **1 · Densidad UI** | Headers cortos, leads ocultos en móvil, menos copy decorativo, cards/filas/stacks más compactos (tap ~44px) | **Hecha** |
| **2 · Inicio útil** | Patrimonio más protagonista, atajos claros, menos bloques/párrafos, IA de Inicio más accionable | **Hecha** |
| **3 · Movimientos** | Alta en menos taps, filtros sticky, edición más rápida | **Hecha** |
| **4 · Feedback** | Toasts al guardar, vacíos con CTA, skeletons | Pendiente |
| **5 · Onboarding** | 3 pasos: cuenta → primer gasto → listo | Pendiente |
| **6 · Polish** | Tipografía/contraste, iconos unificados, Green Deck más limpio | Pendiente |
