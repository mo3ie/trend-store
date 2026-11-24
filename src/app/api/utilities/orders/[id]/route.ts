import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/apiAuth";
import { correctRecipient } from "@/lib/anisUtilities";

type Params = Promise<{ id: string }>;

// PATCH { recipient:[{key,value}] } — correction while Anis has the recharge in suspendedDataError
export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  try { await correctRecipient(user.id, id, Array.isArray(b.recipient) ? b.recipient : []); return NextResponse.json({ success: true }); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }
}
