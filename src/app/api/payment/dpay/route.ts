import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "بوابة DPay غير متاحة" }, { status: 410 });
}
