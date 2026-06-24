import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    // Check if Supabase keys are configured
    const isConfigured = 
      supabaseUrl && 
      supabaseAnonKey && 
      !supabaseUrl.includes("your-project-id") && 
      !supabaseAnonKey.includes("your-supabase-anon-key");

    if (!isConfigured) {
      console.warn("⚠️ Supabase is not configured yet. Set SUPABASE_URL and SUPABASE_ANON_KEY in your environment variables to enable visit tracking.");
      return NextResponse.json({ success: true, skipped: true, message: "Supabase is not configured yet." });
    }

    const body = await request.json();
    const { to, amount, token, userAgent } = body;

    // Get client IP address
    const ipHeader = request.headers.get("x-forwarded-for");
    const ip = ipHeader ? ipHeader.split(",")[0].trim() : "127.0.0.1";

    // Lookup location based on IP address
    let country = "Unknown";
    const isLocalIp = 
      ip === "127.0.0.1" || 
      ip === "::1" || 
      ip.startsWith("192.168.") || 
      ip.startsWith("10.") || 
      ip.startsWith("172.16.") ||
      ip.startsWith("127.");

    if (!isLocalIp) {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=status,country`, {
          next: { revalidate: 3600 }
        });
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData.status !== "fail" && geoData.country) {
            country = geoData.country;
          }
        }
      } catch (err) {
        console.warn("GeoIP lookup error:", err);
      }
    } else {
      country = "Localhost";
    }

    // Insert scan entry into Supabase via REST API
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/scans_new`, {
      method: "POST",
      headers: {
        "apikey": supabaseAnonKey!,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        ip,
        location: country,
        device: userAgent || "Unknown Device",
        amount: amount || "0",
        token: token ? token.toUpperCase() : "USDT",
        to: to || ""
      })
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("Supabase insert error:", dbErr);
      return NextResponse.json(
        { success: false, error: "Database insert failed" },
        { status: 500 }
      );
    }

    const insertedData = await dbRes.json();
    return NextResponse.json({ success: true, scan: insertedData[0] });
  } catch (error) {
    console.error("Failed to log scan:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
