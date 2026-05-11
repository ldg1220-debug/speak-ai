const supabaseUrl       = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

export function isSupabaseConfigured() {
  return !!(supabaseUrl && supabaseServiceKey);
}

export async function supabaseRequest<T = unknown>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown,
): Promise<T | null> {
  if (!supabaseUrl || !supabaseServiceKey) return null;

  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: supabaseServiceKey,
      authorization: `Bearer ${supabaseServiceKey}`,
      "content-type": "application/json",
      prefer: method === "POST" ? "return=representation" : "",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase error: ${res.status} ${text}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : null;
}
