"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

type ScanProgress = {
  ruleId: string;
  name: string;
  productName: string;
  requiredQuantity: number;
  unitsEarned: number;
  currentUnits: number;
  rewardName: string;
  reviewRequired: boolean;
};

type ScanReward = {
  id: string;
  code: string;
  type: "free_product" | "physical_gift";
  name: string;
  status: "issued" | "reserved" | "redeemed" | "revoked" | "expired";
  issuedAt: string;
  expiresAt: string | null;
};

type ScannedMember = {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    membershipNumber: string;
    memberSince: string;
  };
  orderCount: number;
  progress: ScanProgress[];
  rewards: ScanReward[];
};

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

function availableRewards(member: ScannedMember | null) {
  return member?.rewards.filter((reward) => reward.status === "issued") || [];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export default function MemberScanner({ notify }: { notify: (message: string) => void }) {
  const [code, setCode] = useState("");
  const [member, setMember] = useState<ScannedMember | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [redeeming, setRedeeming] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const scanningRef = useRef(false);
  const detectingRef = useRef(false);

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
    return stopCamera;
  }, [stopCamera]);

  const lookup = useCallback(async (rawCode: string) => {
    const nextCode = rawCode.trim();
    if (!nextCode || loading) return;
    setLoading(true);
    setError("");
    setMember(null);
    try {
      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: nextCode }),
      });
      const result = await response.json() as { member?: ScannedMember; error?: string };
      if (!response.ok || !result.member) throw new Error(result.error || "Unable to find this member.");
      setMember(result.member);
      setCode(result.member.profile.membershipNumber);
      navigator.vibrate?.(90);
      notify(`Member found: ${result.member.profile.firstName} ${result.member.profile.lastName}`);
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Unable to find this member.");
      navigator.vibrate?.([60, 60, 60]);
    } finally {
      setLoading(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [loading, notify]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await lookup(code);
  }

  async function startCamera() {
    setError("");
    setCameraMessage("");
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
    if (!Detector) {
      setCameraMessage("Camera QR scanning is not supported by this browser. Use a 2D scanner or enter the member number.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage("Camera access is unavailable. Use a 2D scanner or enter the member number.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");
      video.srcObject = stream;
      await video.play();
      const detector = new Detector({ formats: ["qr_code"] });
      scanningRef.current = true;
      setCameraActive(true);
      setCameraMessage("Point the camera at the member QR code.");

      const scanFrame = async () => {
        if (!scanningRef.current) return;
        if (!detectingRef.current && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          detectingRef.current = true;
          try {
            const results = await detector.detect(video);
            const rawValue = results[0]?.rawValue;
            if (rawValue) {
              setCode(rawValue);
              stopCamera();
              await lookup(rawValue);
              return;
            }
          } catch {
            setCameraMessage("Unable to read this frame. Hold the QR steady and try again.");
          } finally {
            detectingRef.current = false;
          }
        }
        frameRef.current = requestAnimationFrame(() => void scanFrame());
      };
      frameRef.current = requestAnimationFrame(() => void scanFrame());
    } catch (cameraError) {
      stopCamera();
      setCameraMessage(cameraError instanceof Error ? cameraError.message : "Unable to open the camera.");
    }
  }

  async function redeem(reward: ScanReward) {
    if (!member || redeeming) return;
    const action = reward.type === "physical_gift" ? "hand over this gift" : "apply this free product";
    if (!window.confirm(`Confirm that staff will ${action} now? This cannot be undone from this screen.`)) return;
    setRedeeming(reward.id);
    setError("");
    try {
      const response = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: member.profile.membershipNumber, rewardId: reward.id }),
      });
      const result = await response.json() as { redeemed?: boolean; error?: string };
      if (!response.ok || !result.redeemed) throw new Error(result.error || "Unable to redeem this reward.");
      notify(`${reward.name} redeemed`);
      await lookup(member.profile.membershipNumber);
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Unable to redeem this reward.");
    } finally {
      setRedeeming("");
    }
  }

  const rewards = availableRewards(member);
  return <div className="adminStack memberScanner">
    <section className="adminWelcome memberScannerWelcome">
      <div><span>Counter companion</span><h2>Scan a member card in seconds.</h2><p>Works with the device camera, any 2D USB/Bluetooth scanner in keyboard mode, or manual entry.</p></div>
      <button className="adminPrimary" type="button" onClick={cameraActive ? stopCamera : () => void startCamera()}>{cameraActive ? "Stop Camera" : "Open Camera"}</button>
    </section>

    <section className="adminCard memberScannerInputCard">
      <div className="adminCardHead"><div><span className="adminEyebrow">Member identification</span><h3>Scan or enter member number</h3></div><span className="adminHint">Scanner input is submitted with Enter</span></div>
      <form className="memberScannerForm" onSubmit={submit}>
        <input ref={inputRef} value={code} onChange={(event) => setCode(event.target.value)} placeholder="LV-XXXXXXXXXX" autoComplete="off" spellCheck={false} aria-label="Member QR value or member number" />
        <button className="adminPrimary" disabled={loading}>{loading ? "Looking up…" : "Find Member"}</button>
        <button className="adminSecondary" type="button" onClick={() => { setCode(""); setMember(null); setError(""); inputRef.current?.focus(); }}>Clear</button>
      </form>
      <div className={`memberCameraFrame ${cameraActive ? "active" : ""}`}><video ref={videoRef} muted playsInline /><div><strong>{cameraActive ? "Camera active" : "Camera preview"}</strong><span>{cameraMessage || "Open the camera or use a 2D scanner."}</span></div></div>
      {error && <div className="adminLoginError" role="alert">{error}</div>}
    </section>

    {member && <>
      <section className="memberIdentityCard">
        <div className="memberIdentityAvatar">{`${member.profile.firstName[0] || ""}${member.profile.lastName[0] || ""}`.toUpperCase() || "LV"}</div>
        <div><span className="adminEyebrow">Verified LEVIEN member</span><h3>{member.profile.firstName} {member.profile.lastName}</h3><p>{member.profile.membershipNumber} · Member since {formatDate(member.profile.memberSince)}</p></div>
        <div className="memberIdentityContact"><span>{member.profile.phone || "No phone"}</span><small>{member.profile.email}</small></div>
      </section>
      <section className="adminMetrics memberScannerMetrics">
        <div className="adminMetric"><span>Orders</span><strong>{member.orderCount}</strong><small>Linked completed and active orders</small></div>
        <div className="adminMetric"><span>Available rewards</span><strong>{rewards.length}</strong><small>{rewards.length ? "Ready for counter redemption" : "Keep collecting visits"}</small></div>
        <div className="adminMetric"><span>Active programs</span><strong>{member.progress.length}</strong><small>Product-based loyalty rules</small></div>
      </section>
      <div className="memberScannerResults">
        <section className="adminCard">
          <div className="adminCardHead"><div><span className="adminEyebrow">Loyalty progress</span><h3>Current progress</h3></div></div>
          <div className="memberProgressRows">{member.progress.length ? member.progress.map((item) => <article key={item.ruleId}><div><strong>{item.name}</strong><span>{item.currentUnits} of {item.requiredQuantity} · {item.productName}</span></div><div className="memberProgressMeter"><i style={{ width: `${Math.min(100, item.currentUnits / item.requiredQuantity * 100)}%` }} /></div><small>Reward: {item.rewardName}{item.reviewRequired ? " · Manager review flagged" : ""}</small></article>) : <p className="adminHint">No active loyalty progress yet.</p>}</div>
        </section>
        <section className="adminCard">
          <div className="adminCardHead"><div><span className="adminEyebrow">Counter redemption</span><h3>Available rewards</h3></div></div>
          <div className="memberRewardRows">{rewards.length ? rewards.map((reward) => <article key={reward.id}><div><strong>{reward.name}</strong><span>{reward.type === "physical_gift" ? "Physical gift" : "Free menu product"}</span><small>{reward.code}{reward.expiresAt ? ` · expires ${formatDate(reward.expiresAt)}` : " · no expiry"}</small></div><button className="adminPrimary" type="button" disabled={Boolean(redeeming)} onClick={() => void redeem(reward)}>{redeeming === reward.id ? "Redeeming…" : reward.type === "physical_gift" ? "Hand Over" : "Redeem"}</button></article>) : <p className="adminHint">No rewards available for redemption.</p>}</div>
        </section>
      </div>
    </>}
  </div>;
}
