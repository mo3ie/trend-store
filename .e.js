const fs=require("fs");const f="src/lib/catalogCheck.ts";let s=fs.readFileSync(f,"utf8");const crlf=s.includes("\r\n");s=s.replace(/\r\n/g,"\n");
const ed=(a,b)=>{if(s.split(a).length!==2)throw new Error("x:"+a.slice(0,60));s=s.replace(a,b)};
ed(`  const model = process.env.GROQ_SEARCH_MODEL || "groq/compound-mini";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: \`Bearer \${key}\` },
    cache: "no-store",
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 1200,
      messages: [`,`  // Groq has renamed its web-search models several times (404 = name unknown on this
  // account), so try the known names in order, then gpt-oss with the browser_search tool.
  const candidates: { model: string; tools?: unknown[] }[] = [
    ...(process.env.GROQ_SEARCH_MODEL ? [{ model: process.env.GROQ_SEARCH_MODEL }] : []),
    { model: "groq/compound" }, { model: "groq/compound-mini" }, { model: "compound-beta" }, { model: "compound-beta-mini" },
    { model: "openai/gpt-oss-120b", tools: [{ type: "browser_search" }] },
    { model: "openai/gpt-oss-20b", tools: [{ type: "browser_search" }] },
  ];
  const messages = [`);
ed(`        { role: "user", content: \`Product name: \${p.name}\nCategory: \${p.category || "-"}\${variants ? \`\nOptions: \${variants}\` : ""}\` },
      ],
    }),
  });
  if (!res.ok) return { error: \`search_http_\${res.status}\` };`,`        { role: "user", content: \`Product name: \${p.name}\nCategory: \${p.category || "-"}\${variants ? \`\nOptions: \${variants}\` : ""}\` },
  ];
  let res: Response | null = null, lastStatus = 0;
  for (const c of candidates) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: \`Bearer \${key}\` },
      cache: "no-store",
      body: JSON.stringify({ model: c.model, temperature: 0.1, max_tokens: 1500, messages, ...(c.tools ? { tools: c.tools, ...(c.model.includes("gpt-oss") ? { reasoning_effort: "low" } : {}) } : {}) }),
    });
    if (res.ok) break;
    lastStatus = res.status;
    if (![400, 403, 404].includes(res.status)) break; // 429/5xx: stop, retry next run
    res = null;
  }
  if (!res || !res.ok) return { error: \`search_http_\${res?.status || lastStatus}\` };`);
// sources: collect every URL the search tools actually returned (shape differs per model)
ed(`  for (const t of msg?.executed_tools || []) for (const r of t.search_results?.results || []) if (r.url) searched.add(r.url.replace(/\/$/, ""));`,
`  for (const t of msg?.executed_tools || []) for (const r of t.search_results?.results || []) if (r.url) searched.add(r.url.replace(/\/$/, ""));
  for (const u of JSON.stringify(msg?.executed_tools || []).match(/https?:\/\/[^\s"'\\)<>]+/g) || []) searched.add(u.replace(/\/$/, ""));`);
fs.writeFileSync(f,crlf?s.replace(/\n/g,"\r\n"):s);console.log("ok");
