import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const RESEND_KEY = process.env.RESEND_API_KEY!;
const OTP_SECRET = process.env.OTP_HMAC_SECRET || "dev-only-rotate-me";

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function signOTP(email: string, otp: string, expiresAt: number): string {
  const payload = JSON.stringify({ email: email.toLowerCase(), otp, exp: expiresAt });
  const hmac = crypto.createHmac("sha256", OTP_SECRET).update(payload).digest("hex");
  return Buffer.from(payload).toString("base64") + "." + hmac;
}

export async function POST(req: NextRequest) {
  try {
    const { email, name } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    // Check if email already registered in backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL;
    if (backendUrl) {
      try {
        const checkRes = await fetch(`${backendUrl}/api/v1/auth/check-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Tenant-ID": "bandhan" },
          body: JSON.stringify({ email }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData?.data?.exists) {
            return NextResponse.json(
              { error: "An account with this email already exists. Please log in instead." },
              { status: 409 },
            );
          }
        }
      } catch {
        // Non-fatal: if backend is down, allow OTP flow to continue
      }
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    const token = signOTP(email, otp, expiresAt);

    // Send OTP via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Match4Marriage <noreply@match4marriage.com>",
        to: [email],
        subject: "Your Match4Marriage verification code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 24px; background: #fdfbf9;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-family: Georgia, serif; color: #1a0a14; font-size: 28px; margin: 0;">
                Match<span style="color: #dc1e3c;">4</span>Marriage
              </h1>
            </div>
            <div style="background: #fff; border-radius: 16px; padding: 32px; border: 1px solid rgba(220,30,60,0.1);">
              <h2 style="color: #1a0a14; font-size: 20px; margin: 0 0 8px;">Welcome${name ? `, ${name.split(" ")[0]}` : ""}! 💍</h2>
              <p style="color: #666; font-size: 14px; margin: 0 0 24px;">Your verification code is:</p>
              <div style="background: #1a0a14; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #fff;">${otp}</span>
              </div>
              <p style="color: #888; font-size: 13px; margin: 0;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
            </div>
            <p style="text-align: center; color: #aaa; font-size: 12px; margin-top: 24px;">
              &copy; ${new Date().getFullYear()} Match4Marriage Limited &middot; United Kingdom
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Resend error:", err);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, token });
  } catch (err) {
    console.error("send-otp error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
