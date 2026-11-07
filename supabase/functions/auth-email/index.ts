import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function issueSession(
  admin: ReturnType<typeof createClient>,
  email: string,
) {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const token = linkData.properties.email_otp;
  const hashed = linkData.properties.hashed_token;
  if (!token && !hashed) throw new Error("No se pudo emitir OTP de sesión");

  const verify = token
    ? await admin.auth.verifyOtp({ email, token, type: "magiclink" })
    : await admin.auth.verifyOtp({ token_hash: hashed!, type: "email" });

  if (verify.error) throw verify.error;
  if (!verify.data.session) throw new Error("No se creó sesión");
  return verify.data.session;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Método no permitido" });

  try {
    const body = await req.json() as {
      action?: string;
      email?: string;
      password?: string;
      display_name?: string;
    };

    const action = (body.action ?? "signup").toLowerCase();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const displayName = (body.display_name ?? "").trim();

    if (!email || !email.includes("@")) {
      return json(400, { error: "Correo no válido" });
    }
    if (password.length < 8) {
      return json(400, { error: "La contraseña debe tener al menos 8 caracteres" });
    }

    const admin = adminClient();

    if (action === "signup") {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName || email.split("@")[0] },
      });
      if (error) {
        return json(400, {
          error: error.message,
          code: (error as { code?: string }).code ?? null,
        });
      }
      const session = await issueSession(admin, email);
      return json(200, { user: data.user, session });
    }

    if (action === "login") {
      const { data: userId, error: verifyError } = await admin.rpc(
        "verify_user_password",
        { p_email: email, p_password: password },
      );
      if (verifyError) {
        return json(500, { error: verifyError.message, code: verifyError.code ?? null });
      }
      if (!userId) {
        return json(400, {
          error: "Correo o contraseña incorrectos",
          code: "invalid_credentials",
        });
      }
      const session = await issueSession(admin, email);
      return json(200, { session });
    }

    return json(400, { error: "Acción no soportada" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return json(500, { error: message });
  }
});
