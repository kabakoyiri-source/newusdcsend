import { NextResponse } from "next/server";

export async function GET() {
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
      // Return empty scans list with a message so dashboard loads gracefully
      return NextResponse.json({ 
        success: true, 
        scans: [], 
        message: "Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel settings." 
      });
    }

    const dbRes = await fetch(`${supabaseUrl}/rest/v1/scans_new?select=*&order=timestamp.desc`, {
      method: "GET",
      headers: {
        "apikey": supabaseAnonKey!,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Accept": "application/json"
      },
      next: { revalidate: 0 } // Disable fetch caching for real-time updates
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("Supabase select error:", dbErr);
      return NextResponse.json(
        { success: false, error: "Database select failed" },
        { status: 500 }
      );
    }

    const scans = await dbRes.json();
    return NextResponse.json({ success: true, scans });
  } catch (error) {
    console.error("Failed to read scans history:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
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
      return NextResponse.json(
        { success: false, error: "Supabase not configured" },
        { status: 400 }
      );
    }

    // Clear logs from Supabase. We specify id=gt.0 as filter to match all rows
    const dbRes = await fetch(`${supabaseUrl}/rest/v1/scans_new?id=gt.0`, {
      method: "DELETE",
      headers: {
        "apikey": supabaseAnonKey!,
        "Authorization": `Bearer ${supabaseAnonKey}`
      }
    });

    if (!dbRes.ok) {
      const dbErr = await dbRes.text();
      console.error("Supabase delete error:", dbErr);
      return NextResponse.json(
        { success: false, error: "Database delete failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "History cleared successfully" });
  } catch (error) {
    console.error("Failed to clear scans history:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
