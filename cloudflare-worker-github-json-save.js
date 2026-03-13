export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": env.ALLOW_ORIGIN || "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Admin-Key",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = env.GH_PATH || "data/torre_base.json";
    const owner = env.GH_OWNER;
    const repo = env.GH_REPO;
    const branch = env.GH_BRANCH || "main";
    const token = env.GH_TOKEN;
    const adminKey = env.ADMIN_KEY || "";

    if (!owner || !repo || !token) {
      return json({ ok: false, error: "Missing environment vars: GH_OWNER, GH_REPO, GH_TOKEN" }, 500, corsHeaders);
    }

    const ghUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers = {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (request.method === "GET") {
      const current = await fetch(`${ghUrl}?ref=${encodeURIComponent(branch)}`, { headers });
      const data = await current.json();
      if (!current.ok) return json({ ok: false, error: data }, current.status, corsHeaders);
      const content = decodeBase64Unicode(data.content || "");
      return new Response(content, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
      });
    }

    if (request.method === "POST") {
      if (adminKey && request.headers.get("X-Admin-Key") !== adminKey) {
        return json({ ok: false, error: "Unauthorized" }, 401, corsHeaders);
      }

      const body = await request.json();
      if (!Array.isArray(body.records)) {
        return json({ ok: false, error: "Body must be { records: [...] }" }, 400, corsHeaders);
      }

      // 1) get current sha
      const current = await fetch(`${ghUrl}?ref=${encodeURIComponent(branch)}`, { headers });
      const currentData = await current.json();
      if (!current.ok) return json({ ok: false, error: currentData }, current.status, corsHeaders);

      // 2) put updated content
      const nextContent = encodeBase64Unicode(JSON.stringify(body.records, null, 2));
      const payload = {
        message: body.message || "Atualiza base Torre via painel admin",
        content: nextContent,
        sha: currentData.sha,
        branch
      };

      const putRes = await fetch(ghUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const putData = await putRes.json();
      if (!putRes.ok) return json({ ok: false, error: putData }, putRes.status, corsHeaders);

      return json({ ok: true, commit: putData.commit?.sha || null, content_sha: putData.content?.sha || null }, 200, corsHeaders);
    }

    return json({ ok: false, error: "Method not allowed" }, 405, corsHeaders);
  }
};

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}

function decodeBase64Unicode(str) {
  const clean = String(str).replace(/\n/g, "");
  const bin = atob(clean);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64Unicode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
