import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { ADMIN_SESSION_COOKIE, verifyAdminSession } from "@/lib/admin-session";
import { isSameOriginRequest, requestBodyExceeds } from "@/lib/request-security";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "catalog-images";
const scopes = new Set(["product", "combo", "promotion", "logo", "about"]);
const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (requestBodyExceeds(request, 6 * 1024 * 1024)) {
      return NextResponse.json({ error: "Image upload is too large." }, { status: 413 });
    }
    const cookieStore = await cookies();
    if (!verifyAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const scope = String(formData.get("scope") || "");
    if (!(file instanceof File) || !scopes.has(scope)) {
      return NextResponse.json({ error: "Invalid image upload." }, { status: 400 });
    }
    const extension = extensions[file.type];
    if (!extension || file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "Use a JPG, PNG, or WebP image up to 5 MB." }, { status: 400 });
    }

    const path = `${scope}/${randomUUID()}.${extension}`;
    const supabase = createAdminClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl }, { status: 201 });
  } catch (error) {
    console.error("Unable to upload admin image:", error);
    return NextResponse.json({ error: "Unable to upload image." }, { status: 500 });
  }
}
