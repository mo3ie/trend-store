import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

const MATCH_TYPES = ["any_contains", "all_contains", "exact", "regex", "catch_all"];
const EDITABLE = ["name", "keywords", "match_type", "public_reply", "private_reply", "attachments", "enabled", "priority"] as const;

// Confirms the config belongs to the user; returns it or null.
async function ownedConfig(configId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from("bot_configs").select("id").eq("id", configId).eq("user_id", userId).maybeSingle();
  return data;
}

// GET — rules for a config. ?configId=
export async function GET(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const configId = req.nextUrl.searchParams.get("configId");
  if (!configId) return NextResponse.json({ error: "configId مطلوب" }, { status: 400 });
  if (!(await ownedConfig(configId, user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const { data: rules } = await supabaseAdmin
    .from("bot_rules").select("*").eq("config_id", configId)
    .order("priority", { ascending: false }).order("created_at", { ascending: true });
  return NextResponse.json({ rules: rules || [] });
}

// POST — create a rule. Body: { configId, name, keywords[], match_type, public_reply, private_reply, attachments[], priority }
export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const { configId } = body;
  if (!configId) return NextResponse.json({ error: "configId مطلوب" }, { status: 400 });
  if (!(await ownedConfig(configId, user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const match_type = MATCH_TYPES.includes(body.match_type) ? body.match_type : "any_contains";
  const { data: rule, error } = await supabaseAdmin.from("bot_rules").insert({
    config_id:     configId,
    name:          body.name ?? null,
    keywords:      Array.isArray(body.keywords) ? body.keywords : [],
    match_type,
    public_reply:  body.public_reply ?? null,
    private_reply: body.private_reply ?? null,
    attachments:   Array.isArray(body.attachments) ? body.attachments : [],
    priority:      Number.isFinite(body.priority) ? body.priority : 0,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule });
}

// PATCH — update a rule. Body: { id, ...fields }
export async function PATCH(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  // Verify ownership through the parent config.
  const { data: rule } = await supabaseAdmin.from("bot_rules").select("config_id").eq("id", id).maybeSingle();
  if (!rule || !(await ownedConfig(rule.config_id, user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = body[k];
  if (patch.match_type && !MATCH_TYPES.includes(patch.match_type as string)) delete patch.match_type;

  const { data: updated, error } = await supabaseAdmin.from("bot_rules").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rule: updated });
}

// DELETE — ?id=
export async function DELETE(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id مطلوب" }, { status: 400 });

  const { data: rule } = await supabaseAdmin.from("bot_rules").select("config_id").eq("id", id).maybeSingle();
  if (!rule || !(await ownedConfig(rule.config_id, user.id))) return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });

  await supabaseAdmin.from("bot_rules").delete().eq("id", id);
  return NextResponse.json({ ok: true });
}
