import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const TOKEN_DECIMALS = 6;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const to = searchParams.get("to") || "";
  const amount = searchParams.get("amount") || "";
  const token = (searchParams.get("token") || "USDT").toUpperCase();

  // 1. Log the scan into scans3
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    const isConfigured = 
      supabaseUrl && 
      supabaseAnonKey && 
      !supabaseUrl.includes("your-project-id") && 
      !supabaseAnonKey.includes("your-supabase-anon-key");

    if (isConfigured) {
      const ipHeader = request.headers.get("x-forwarded-for");
      const ip = ipHeader ? ipHeader.split(",")[0].trim() : "127.0.0.1";

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

      await fetch(`${supabaseUrl}/rest/v1/scans3`, {
        method: "POST",
        headers: {
          "apikey": supabaseAnonKey!,
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ip,
          location: country,
          device: "Android QR Scanner",
          amount: amount || "0",
          token: token,
          to: to,
          platform: "Android"
        })
      });
    }
  } catch (err) {
    console.error("Failed to log Android scan:", err);
  }

  // 2. Generate and redirect to Trust Wallet deep link
  try {
    const tokenAddress = token === "USDC" ? USDC_ADDRESS : USDT_ADDRESS;
    const normalizedAmount = amount.replace(",", ".").trim();
    
    if (to && normalizedAmount && !isNaN(Number(normalizedAmount)) && Number(normalizedAmount) > 0) {
      const amountWei = ethers.parseUnits(normalizedAmount, TOKEN_DECIMALS);
      const iface = new ethers.Interface([
        "function transfer(address to, uint256 amount) external",
      ]);
      const callData = iface.encodeFunctionData("transfer", [
        to,
        amountWei,
      ]);

      const redirectUrl = `https://link.trustwallet.com/send?asset=c60&address=${tokenAddress}&data=${callData}`;
      return NextResponse.redirect(redirectUrl);
    }
  } catch (err) {
    console.error("Failed to redirect Android scan:", err);
  }

  // Fallback if anything goes wrong or params are missing
  return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
}
