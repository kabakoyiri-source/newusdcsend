"use client";

import { useState, useEffect, useRef } from "react";

const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const TOKEN_DECIMALS = 6;

function encodeTransferData(to: string, amount: string): string {
  const signature = "a9059cbb";
  const addr = to.toLowerCase().replace("0x", "").padStart(64, "0");
  const amountFloat = parseFloat(amount.replace(",", "."));
  if (isNaN(amountFloat) || amountFloat <= 0) throw new Error("Invalid amount");
  const amountWei = BigInt(Math.floor(amountFloat * 10 ** TOKEN_DECIMALS));
  const amountHex = amountWei.toString(16).padStart(64, "0");
  return "0x" + signature + addr + amountHex;
}

export default function AdminPage() {
  const [receiverAddress, setReceiverAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [token, setToken] = useState<"USDT" | "USDC">("USDT");
  const [platform, setPlatform] = useState<"ios" | "android">("ios");
  const [qrUrl, setQrUrl] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);
  const qrCodeInstanceRef = useRef<any>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");

  const [toastMessage, setToastMessage] = useState("");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2000);
  };

  // ========== ANTI‑INSPECT ==========
  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
        (e.ctrlKey && e.key === "U")
      ) {
        e.preventDefault();
        return false;
      }
    };

    const blockContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener("keydown", blockKeys);
    document.addEventListener("contextmenu", blockContextMenu);

    let devToolsOpen = false;
    const checkDevTools = () => {
      const threshold = 160;
      if (
        window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold
      ) {
        if (!devToolsOpen) {
          devToolsOpen = true;
          document.body.innerHTML =
            "<div style='color:white;text-align:center;margin-top:50vh;font-size:24px;'>Access denied</div>";
        }
      } else {
        devToolsOpen = false;
      }
    };

    const interval = setInterval(checkDevTools, 1000);

    return () => {
      document.removeEventListener("keydown", blockKeys);
      document.removeEventListener("contextmenu", blockContextMenu);
      clearInterval(interval);
    };
  }, []);

  // Chargement des préférences
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedToken = localStorage.getItem("admin_token");
      if (savedToken === "USDT" || savedToken === "USDC") setToken(savedToken);

      const auth = sessionStorage.getItem("admin_auth");
      if (auth === "true") {
        setIsAuthenticated(true);
      }
      setIsMounted(true);
    }
  }, []);

  // Génération du QR code
  useEffect(() => {
    if (!isMounted || typeof window === "undefined" || !isAuthenticated) return;

    localStorage.setItem("admin_token", token);

    if (!receiverAddress) {
      setQrUrl("");
      return;
    }

    const origin = window.location.origin;
    const baseUrl = `${origin}/wallet`;
    const tokenAddress = token === "USDC" ? USDC_ADDRESS : USDT_ADDRESS;

    if (platform === "ios") {
      // Version iOS : paramètres classiques (to, amount, token)
      const targetUrl = `${baseUrl}?to=${encodeURIComponent(receiverAddress)}&amount=${encodeURIComponent(amount)}&token=${encodeURIComponent(token.toLowerCase())}`;
      const trustWalletLink = `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(targetUrl)}`;
      setQrUrl(trustWalletLink);
    } else {
      // Version Android : deep link send
      const normalizedAmount = amount.replace(",", ".").trim();
      if (!normalizedAmount || isNaN(Number(normalizedAmount)) || Number(normalizedAmount) <= 0) {
        setQrUrl("");
        return;
      }

      try {
        const callData = encodeTransferData(receiverAddress, normalizedAmount);
        const sendUrl = `https://link.trustwallet.com/send?asset=c60&address=${tokenAddress}&data=${callData}`;
        setQrUrl(sendUrl);
      } catch (err) {
        console.error("Failed to encode transfer data", err);
        setQrUrl("");
      }
    }
  }, [receiverAddress, amount, token, platform, isMounted, isAuthenticated]);

  // Rendu du QR code
  useEffect(() => {
    if (!qrUrl || typeof window === "undefined" || !isMounted || !isAuthenticated) return;

    import("qr-code-styling").then((QRCodeStylingModule) => {
      const QRCodeStyling = QRCodeStylingModule.default;
      const options = {
        width: 240,
        height: 240,
        type: "svg" as const,
        data: qrUrl,
        image: "/trust.png",
        dotsOptions: { color: "#000000", type: "extra-rounded" as const },
        cornersSquareOptions: { color: "#000000", type: "extra-rounded" as const },
        cornersDotOptions: { color: "#000000", type: "dot" as const },
        backgroundOptions: { color: "#ffffff" },
        imageOptions: { crossOrigin: "anonymous", margin: 6, imageSize: 0.35, hideBackgroundDots: true },
      };

      if (!qrCodeInstanceRef.current) {
        qrCodeInstanceRef.current = new QRCodeStyling(options);
        if (qrCanvasRef.current) {
          qrCanvasRef.current.innerHTML = "";
          qrCodeInstanceRef.current.append(qrCanvasRef.current);
        }
      } else {
        qrCodeInstanceRef.current.update(options);
      }
    });
  }, [qrUrl, isMounted, isAuthenticated]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (usernameInput === "miami" && passwordInput === "rolex2026") {
      setIsAuthenticated(true);
      setAuthError("");
      if (typeof window !== "undefined") sessionStorage.setItem("admin_auth", "true");
    } else {
      setAuthError("Username or Password incorrect.");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") sessionStorage.removeItem("admin_auth");
  };

  const handleCopyAddress = () => {
    if (typeof navigator !== "undefined" && receiverAddress) {
      navigator.clipboard.writeText(receiverAddress).then(() => showToast("Address copied!"));
    }
  };

  const handleSetAmountClick = () => {
    if (amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && qrUrl) {
      if (navigator.share) {
        navigator.share({
          title: "Payment Link",
          text: `Send ${amount} ${token} to ${receiverAddress}`,
          url: qrUrl,
        }).catch((err) => console.log("Share failed:", err));
      } else {
        navigator.clipboard.writeText(qrUrl).then(() => showToast("Payment link copied!"));
      }
    }
  };

  if (!isAuthenticated && isMounted) {
    return (
      <main className="transfer-main">
        <div className="home-content" style={{ maxWidth: "400px" }}>
          <h1 className="home-title" style={{ marginBottom: "1.5rem", color: "#0f172a" }}>
            Admin Access
          </h1>
          <form onSubmit={handleLogin} className="form-container" style={{ width: "100%", textAlign: "left" }}>
            <label className="form-label">Username</label>
            <div className="input-row" style={{ marginBottom: "1.25rem" }}>
              <input
                type="text" value={usernameInput} onChange={(e) => setUsernameInput(e.target.value)}
                className="input-row__field" placeholder="Enter username" required
              />
            </div>
            <label className="form-label">Password</label>
            <div className="input-row" style={{ marginBottom: "1.5rem" }}>
              <input
                type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)}
                className="input-row__field" placeholder="Enter password" required
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

  if (!isMounted) {
    return (
      <main className="transfer-main">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
          <span className="btn-spinner" style={{ borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#2563eb" }} />
        </div>
      </main>
    );
  }

  return (
    <main className="transfer-main">
      <div className="home-content" ref={qrRef} style={{ maxWidth: "520px", position: "relative" }}>
        <button onClick={handleLogout} style={{
          position: "absolute", top: "-10px", right: "0px", background: "transparent",
          border: "none", color: "#ef4444", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer"
        }}>
          Logout 🚪
        </button>

        <h1 className="home-title" style={{ marginBottom: "1.5rem", color: "#0f172a" }}>
          Admin Dashboard
        </h1>
        
        <div className="form-container" style={{ width: "100%", textAlign: "left", marginBottom: "2rem" }}>
          <label className="form-label">Select Asset</label>
          <div className="token-tabs">
            <button type="button" className={`token-tab ${token === "USDT" ? "token-tab--active" : ""}`} onClick={() => setToken("USDT")}>USDT</button>
            <button type="button" className={`token-tab ${token === "USDC" ? "token-tab--active" : ""}`} onClick={() => setToken("USDC")}>USDC</button>
          </div>

          <label className="form-label" style={{ marginTop: "1.25rem" }}>Platform</label>
          <div className="token-tabs">
            <button type="button" className={`token-tab ${platform === "ios" ? "token-tab--active" : ""}`} onClick={() => setPlatform("ios")}>iOS (Wallet)</button>
            <button type="button" className={`token-tab ${platform === "android" ? "token-tab--active" : ""}`} onClick={() => setPlatform("android")}>Android (Send)</button>
          </div>

          <label className="form-label" style={{ marginTop: "1rem" }}>Receiver Address</label>
          <div className="input-row" style={{ marginBottom: "1.25rem" }}>
            <input type="text" value={receiverAddress} onChange={(e) => setReceiverAddress(e.target.value)} className="input-row__field" placeholder="0x..." />
          </div>

          <label className="form-label">Amount ({token})</label>
          <div className="input-row">
            <input type="text" ref={amountInputRef} value={amount} onChange={(e) => setAmount(e.target.value)} className="input-row__field" placeholder="1.0" />
          </div>
          {platform === "android" && (
            <div style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "0.25rem" }}>
              {(() => {
                const normalized = amount.replace(",", ".").trim();
                if (!amount || !normalized || isNaN(Number(normalized)) || Number(normalized) <= 0) {
                  return "Amount is required (use . or , as decimal separator).";
                }
                return "";
              })()}
            </div>
          )}
        </div>

        <div className="admin-qr-section" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "1.5rem", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.05)" }}>
          <div className="receive-header-bar">
            <button type="button" className="receive-header-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <span className="receive-header-title">Receive</span>
            <button type="button" className="receive-header-btn" style={{ padding: 0, cursor: "default" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="#334155" />
                <line x1="12" y1="16" x2="12" y2="12" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="12" cy="8" r="1.25" fill="#ffffff" />
              </svg>
            </button>
          </div>

          <div className="receive-alert-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="receive-alert-icon">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
            <div className="receive-alert-text">
              {token === "USDT" 
                ? "Send only Tether USD (ERC20) to this address. Other assets will be lost forever."
                : "Send only USD Coin (ERC20) to this address. Other assets will be lost forever."}
            </div>
          </div>

          <div className="receive-asset-row">
            {token === "USDT" ? (
              <img src="/usdt.png" alt="USDT" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
            ) : (
              <img src="/usdc.png" alt="USDC" style={{ width: "30px", height: "30px", objectFit: "contain" }} />
            )}
            <span className="receive-asset-name">{token}</span>
            <span className="receive-network-badge">Ethereum</span>
          </div>

          {qrUrl ? (
            <div className="qr-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#ffffff", padding: "0.5rem 0.5rem 0.75rem 0.5rem", borderRadius: "1.25rem", border: "none", boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)", width: "fit-content", margin: "0 auto 0.75rem" }}>
              <div ref={qrCanvasRef} style={{ display: "flex", justifyContent: "center", alignItems: "center" }} />
              {receiverAddress && (
                <div className="qr-address" style={{ marginTop: "0.35rem", marginBottom: 0, fontSize: "0.85rem", color: "#1e293b", fontWeight: "600", letterSpacing: "0.02em", width: "100%", textAlign: "center" }}>
                  <div>{receiverAddress.slice(0, 23)}</div>
                  <div>{receiverAddress.slice(23)}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ width: 260, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#fff", borderRadius: "1.5rem", border: "1px solid #e5e7eb", margin: "0 auto 1.5rem", padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.9rem" }}>
              <span style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🔑</span>
              <div>
                {platform === "android" && (!amount || isNaN(Number(amount.replace(",", "."))) || Number(amount.replace(",", ".")) <= 0)
                  ? "Enter a valid amount to generate Android QR"
                  : "Enter a receiver address to generate QR Code"}
              </div>
            </div>
          )}

          <div className="qr-actions-container" style={{ marginTop: "0.5rem" }}>
            <div className="qr-action-item">
              <button onClick={handleCopyAddress} className="qr-action-btn" title="Copy Address">
                <img src="/copy.png" alt="Copy" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
              </button>
              <span className="qr-action-label">Copy</span>
            </div>
            <div className="qr-action-item">
              <button onClick={handleSetAmountClick} className="qr-action-btn" title="Set Amount">
                <img src="/amount.png" alt="Set Amount" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
              </button>
              <span className="qr-action-label">Set Amount</span>
            </div>
            <div className="qr-action-item">
              <button onClick={handleShare} className="qr-action-btn" title="Share Link">
                <img src="/share.png" alt="Share" style={{ width: "32px", height: "32px", objectFit: "contain" }} />
              </button>
              <span className="qr-action-label">Share</span>
            </div>
          </div>

          <div className="receive-deposit-box">
            <div className="receive-deposit-icon" style={{ backgroundColor: "#b4baf3", color: "#000000" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>
            <div className="receive-deposit-info">
              <span className="receive-deposit-title">Deposit from exchange</span>
              <span className="receive-deposit-subtitle">By direct transfer from your account</span>
            </div>
          </div>
        </div>

        {toastMessage && <div className="copy-toast">{toastMessage}</div>}
      </div>
    </main>
  );
}