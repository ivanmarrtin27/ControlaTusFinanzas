import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIRM_WORD = "ELIMINAR";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json(401, { error: "Falta autorización" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, { error: "Configuración del servidor incompleta" });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json(401, { error: "Sesión no válida" });
    }
    const userId = userData.user.id;

    let body: { confirm?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    if ((body.confirm ?? "").trim().toUpperCase() !== CONFIRM_WORD) {
      return json(400, { error: `Confirma escribiendo ${CONFIRM_WORD}` });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Borrar datos de negocio (orden respetando FKs). profiles/auth CASCADE también limpia,
    // pero vaciamos explícitamente por claridad y tablas sin cascade desde auth.
    const tables = [
      "transaction_tags",
      "debt_payments",
      "goal_contributions",
      "transactions",
      "transfers",
      "budgets",
      "recurring_rules",
      "goals",
      "debts",
      "tags",
      "categories",
      "accounts",
      "profiles",
    ] as const;

    for (const table of tables) {
      const { error } = await admin.from(table).delete().eq(
        table === "profiles" ? "id" : "user_id",
        userId,
      );
      if (error) {
        return json(500, { error: `Error al borrar ${table}: ${error.message}` });
      }
    }

    const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
    if (deleteAuthError) {
      return json(500, { error: `Datos borrados pero falló auth: ${deleteAuthError.message}` });
    }

    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json(500, { error: message });
  }
});
