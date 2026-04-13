import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const OTP_SECRET = process.env.SUPABASE_SERVICE_KEY!;

function verifyToken(token: string, code: string): { valid: boolean; email?: string; error?: string } {
  try {
    const [b64, hmac] = token.split(".");
    const payload = Buffer.from(b64, "base64").toString("utf8");
    const expected = crypto.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
    if (hmac !== expected) return { valid: false, error: "Invalid token" };
    const data = JSON.parse(payload);
    if (Date.now() > data.exp) return { valid: false, error: "Code expired. Please register again." };
    if (data.otp !== code) return { valid: false, error: "Incorrect code. Please try again." };
    return { valid: true, email: data.email };
  } catch {
    return { valid: false, error: "Invalid token" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token, code, password, name, gender } = await req.json();
    if (!token || !code) return NextResponse.json({ error: "Code required" }, { status: 400 });

    const result = verifyToken(token, code);
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });

    const email = result.email!;

    // Create user in Supabase Auth (admin — auto-confirmed)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, gender },
    });

    if (userError) {
      // If user already exists, that's fine — they proved email ownership via OTP
      if (userError.message.toLowerCase().includes("already")) {
        // Try to fetch the existing user so we can return their ID
        const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingList?.users?.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );
        return NextResponse.json({
          success: true,
          user_id: existingUser?.id ?? null,
          existing: true,
        });
      }
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, user_id: userData.user?.id });
  } catch (err) {
    console.error("verify-otp error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
