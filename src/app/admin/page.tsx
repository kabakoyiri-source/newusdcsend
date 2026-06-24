"use client";

import { useState, useEffect } from "react";

interface ScanLog {
  timestamp: string;
  ip: string;
  location: string;
  device: string;
  amount: string;
  token: string;
  to: string;
  platform?: string;
}

export default function AdminPage() {
  const [scans, setScans] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [clearing, setClearing] = useState(false);

  // États pour l'authentification (comme sur la page principale)
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  // Charger l'état d'authentification au montage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
      setIsMounted(true);
    }
  }, []);

  // Fetch scan history (uniquement si authentifié)
  const fetchScans = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("/api/admin/scans");
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
      } else {
        setError("Failed to fetch scans history.");
      }
    } catch (err) {
      console.error(err);
      setError("An error occurred while fetching scans.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchScans();
    }
  }, [isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "Dubai2026") {
      setIsAuthenticated(true);
      setAuthError("");
      if (typeof window !== "undefined") {
        sessionStorage.setItem("admin_auth", "true");
      }
    } else {
      setAuthError("Password incorrect.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("admin_auth");
    }
  };

  // Clear scans log
  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear the entire scan history? This action cannot be undone.")) {
      return;
    }
    try {
      setClearing(true);
      const res = await fetch("/api/admin/scans", { method: "DELETE" });
      if (res.ok) {
        setScans([]);
      } else {
        alert("Failed to clear history.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while clearing history.");
    } finally {
      setClearing(false);
    }
  };

  // Helper to parse float and handle commas
  const parseVal = (valStr: string) => {
    const parsed = parseFloat(valStr.replace(",", "."));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculate statistics
  const totalScans = scans.length;
  const usdtVolume = scans
    .filter((s) => s.token.toLowerCase() === "usdt")
    .reduce((sum, s) => sum + parseVal(s.amount), 0);
  const usdcVolume = scans
    .filter((s) => s.token.toLowerCase() === "usdc")
    .reduce((sum, s) => sum + parseVal(s.amount), 0);

  // Rendu de l'écran de chargement initial si non encore monté
  if (!isMounted) {
    return (
      <main className="transfer-main">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <span className="btn-spinner" style={{ borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#2563eb" }} />
        </div>
      </main>
    );
  }

  // Rendu de l'écran de connexion si non connecté
  if (!isAuthenticated) {
    return (
      <main className="transfer-main">
        <div className="home-content" style={{ maxWidth: "400px" }}>
          <h1 className="home-title" style={{ marginBottom: "1.5rem", color: "#0f172a" }}>
            Admin Access
          </h1>
          
          <form onSubmit={handleLogin} className="form-container" style={{ width: "100%", textAlign: "left" }}>
            <label className="form-label">Password</label>
            <div className="input-row" style={{ marginBottom: "1.5rem" }}>
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="input-row__field"
                placeholder="Enter password"
                required
              />
            </div>

            {authError && (
              <div style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "1rem", fontWeight: "500" }}>
                ⚠️ {authError}
              </div>
            )}

            <button type="submit" className="next-btn" style={{ width: "100%", padding: "0.75rem" }}>
              Login
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main style={{
      minHeight: "100vh",
      backgroundColor: "#f8fafc",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: "#0f172a",
      padding: "2rem 1.5rem"
    }}>
      <div style={{
        maxWidth: "1100px",
        margin: "0 auto"
      }}>
        {/* Header Dashboard */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2.5rem",
          flexWrap: "wrap",
          gap: "1rem"
        }}>
          <div>
            <h1 style={{
              fontSize: "1.75rem",
              fontWeight: 800,
              margin: 0,
              color: "#0f172a",
              letterSpacing: "-0.025em",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem"
            }}>
              <span style={{ color: "#0033ff" }}>🛡️</span> Scan History Admin
            </h1>
            <p style={{
              margin: "0.25rem 0 0 0",
              color: "#64748b",
              fontSize: "0.9rem"
            }}>
              Monitor real-time QR code scans and client landing activity
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button 
              onClick={fetchScans}
              disabled={loading}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e2e8f0",
                color: "#475569",
                fontWeight: 600,
                fontSize: "0.85rem",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.5rem",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              🔄 Refresh
            </button>
            <button 
              onClick={handleClearHistory}
              disabled={clearing || scans.length === 0}
              style={{
                backgroundColor: scans.length === 0 ? "#cbd5e1" : "#ef4444",
                border: "none",
                color: "#ffffff",
                fontWeight: 600,
                fontSize: "0.85rem",
                padding: "0.6rem 1.1rem",
                borderRadius: "0.5rem",
                cursor: scans.length === 0 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease",
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
              }}
            >
              🗑️ Clear History
            </button>
            <button 
              onClick={handleLogout}
              style={{
                backgroundColor: "transparent",
                border: "none",
                color: "#ef4444",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
                padding: "0.6rem 1.1rem",
                transition: "opacity 0.15s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Logout 🚪
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "1.5rem",
          marginBottom: "2.5rem"
        }}>
          {/* Stat 1 */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            padding: "1.5rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Total Scans
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "#0033ff" }}>
              {totalScans}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Visits triggered by QR Code
            </div>
          </div>

          {/* Stat 2 */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            padding: "1.5rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              USDT Scanned Volume
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "#0f172a" }}>
              {usdtVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} <span style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b" }}>USDT</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Sum of values loaded in USDT QR scans
            </div>
          </div>

          {/* Stat 3 */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            padding: "1.5rem",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)",
            border: "1px solid #e2e8f0"
          }}>
            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              USDC Scanned Volume
            </div>
            <div style={{ fontSize: "2rem", fontWeight: 800, marginTop: "0.5rem", color: "#0f172a" }}>
              {usdcVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })} <span style={{ fontSize: "1rem", fontWeight: 600, color: "#64748b" }}>USDC</span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Sum of values loaded in USDC QR scans
            </div>
          </div>
        </section>

        {/* Scan Log Section */}
        <section style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          boxShadow: "0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02)",
          border: "1px solid #e2e8f0",
          overflow: "hidden"
        }}>
          <div style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <h2 style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              margin: 0,
              color: "#0f172a"
            }}>
              Recent Activity Logs
            </h2>
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "#64748b",
              backgroundColor: "#f1f5f9",
              padding: "0.25rem 0.6rem",
              borderRadius: "2rem"
            }}>
              {scans.length} records
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#64748b" }}>
              <div style={{
                display: "inline-block",
                width: "28px",
                height: "28px",
                border: "3px solid #e2e8f0",
                borderTopColor: "#0033ff",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                marginBottom: "1rem"
              }} />
              <div>Loading activity logs...</div>
            </div>
          ) : error ? (
            <div style={{ padding: "4rem 2rem", textAlign: "center", color: "#ef4444", fontWeight: 500 }}>
              ⚠️ {error}
            </div>
          ) : scans.length === 0 ? (
            <div style={{ padding: "5rem 2rem", textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📭</div>
              <div style={{ fontWeight: 600, color: "#64748b" }}>No scan activity logged yet</div>
              <p style={{ fontSize: "0.85rem", margin: "0.25rem 0 0 0", color: "#94a3b8" }}>
                Scan logs will populate here as visitors open the QR payment pages
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{
                width: "100%",
                borderCollapse: "collapse",
                textAlign: "left",
                fontSize: "0.9rem"
              }}>
                <thead>
                  <tr style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    color: "#475569",
                    fontWeight: 600
                  }}>
                    <th style={{ padding: "1rem 1.5rem" }}>Date & Time</th>
                    <th style={{ padding: "1rem 1.5rem" }}>App / Browser</th>
                    <th style={{ padding: "1rem 1.5rem" }}>Platform</th>
                    <th style={{ padding: "1rem 1.5rem" }}>Scanned Config</th>
                    <th style={{ padding: "1rem 1.5rem" }}>Dest. Address</th>
                  </tr>
                </thead>
                <tbody>
                  {scans.map((scan, idx) => (
                    <tr 
                      key={idx} 
                      style={{
                        borderBottom: idx === scans.length - 1 ? "none" : "1px solid #f1f5f9",
                        transition: "background-color 0.15s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                    >
                      <td style={{ padding: "1rem 1.5rem", color: "#334155", fontWeight: 500 }}>
                        {new Date(scan.timestamp).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit"
                        })}
                      </td>
                      <td style={{ padding: "1rem 1.5rem", color: "#475569" }}>
                        <div style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          backgroundColor: scan.device.includes("Trust") ? "#eff6ff" : scan.device.includes("MetaMask") ? "#fff7ed" : "#f1f5f9",
                          color: scan.device.includes("Trust") ? "#1d4ed8" : scan.device.includes("MetaMask") ? "#c2410c" : "#475569",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.375rem",
                          fontSize: "0.8rem",
                          fontWeight: 500
                        }}>
                          {scan.device.includes("Trust") ? "🔵" : scan.device.includes("MetaMask") ? "🟠" : "📱"}{" "}
                          {scan.device}
                        </div>
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        {scan.platform === "iOS" ? (
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            backgroundColor: "#f5f5f7",
                            color: "#1d1d1f",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.8rem",
                            fontWeight: 600
                          }}>
                            🍎 iOS
                          </div>
                        ) : scan.platform === "Android" ? (
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            backgroundColor: "#e8f5e9",
                            color: "#2e7d32",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.8rem",
                            fontWeight: 600
                          }}>
                            🤖 Android
                          </div>
                        ) : (
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            backgroundColor: "#f1f5f9",
                            color: "#475569",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.8rem",
                            fontWeight: 500
                          }}>
                            💻 Other
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          {scan.amount} {scan.token}
                        </div>
                        <div style={{
                          display: "inline-block",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: "#f1f5f9",
                          color: "#64748b",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "2rem",
                          marginTop: "2px"
                        }}>
                          Ethereum
                        </div>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", fontFamily: "monospace", fontSize: "0.8rem", color: "#64748b", wordBreak: "break-all" }}>
                        {scan.to || "Default"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}
