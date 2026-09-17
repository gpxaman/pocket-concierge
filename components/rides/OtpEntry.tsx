"use client";

import { useRef, useState } from "react";
import clsx from "clsx";

export default function OtpEntry({ otp, onVerified }: { otp: string; onVerified: () => void }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [err, setErr] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(i: number, raw: string) {
    const v = raw.slice(-1);
    if (v && !/^[0-9]$/.test(v)) return;
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    setErr(false);
    if (v && i < 3) refs.current[i + 1]?.focus();
  }

  function verify(code: string) {
    if (code === otp) {
      onVerified();
    } else {
      setErr(true);
      setDigits(["", "", "", ""]);
      refs.current[0]?.focus();
    }
  }

  return (
    <div>
      <div className="flex justify-center gap-2">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            inputMode="numeric"
            maxLength={1}
            className={clsx(
              "h-12 w-11 rounded-xl2 border bg-white text-center text-lg font-bold text-ink outline-none",
              err ? "border-red-400" : "border-black/15 focus:border-accentDark"
            )}
          />
        ))}
      </div>
      {err && <p className="mt-2 text-center text-xs font-medium text-red-600">Incorrect code — try again.</p>}
      <button
        onClick={() => verify(digits.join(""))}
        disabled={digits.some((d) => !d)}
        className="mt-3 flex w-full items-center justify-center rounded-full bg-accent py-3 text-sm font-semibold text-ink transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Verify &amp; start ride
      </button>
      <button
        onClick={() => {
          setDigits(otp.split(""));
          verify(otp);
        }}
        className="mt-2 flex w-full items-center justify-center rounded-full border border-black/10 py-2.5 text-xs font-medium text-ink/60 transition hover:border-ink/30"
      >
        Scan driver&apos;s QR (demo)
      </button>
    </div>
  );
}
