import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getAuthUser } from "@/lib/authUser";

/**
 * POST (multipart, field `file`) — upload an image or a video from the owner's own
 * device, for use as a post's media.
 *
 * Uploading costs nothing and is deliberately available on every plan: the paid
 * allowance meters AI *generation*, not the merchant's own photos and clips.
 * Facebook publishes the video from the public URL we return, so the file has to
 * live somewhere reachable — the same public `products` bucket the bot uses, under
 * a per-user prefix.
 */

const IMAGES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const VIDEOS = ["video/mp4", "video/quicktime", "video/x-m4v", "video/webm"];

const MAX_IMAGE = 10 * 1024 * 1024;   // 10 MB
const MAX_VIDEO = 90 * 1024 * 1024;   // 90 MB — comfortably inside Facebook's own limits

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "غير مسجل" }, { status: 401 });

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "لم يتم إرسال ملف" }, { status: 400 });

    const isVideo = VIDEOS.includes(file.type);
    const isImage = IMAGES.includes(file.type);
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: "نوع الملف غير مسموح — صور أو فيديو (MP4/MOV/WebM)" }, { status: 400 });
    }

    const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
    if (file.size > max) {
      return NextResponse.json({
        error: `حجم الملف يتجاوز ${Math.round(max / 1024 / 1024)} ميغابايت`,
      }, { status: 413 });
    }

    const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
    const path = `studio/${user.id}/${Date.now()}-${safeName}`;

    const { error } = await supabaseAdmin.storage
      .from("products")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = supabaseAdmin.storage.from("products").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl, type: isVideo ? "video" : "image" });
  } catch {
    return NextResponse.json({ error: "تعذّر رفع الملف" }, { status: 500 });
  }
}
