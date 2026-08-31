"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getLocalCallStream, getRemoteCallStream, subscribeCallMedia, useChatStore } from "@/lib/store/useChatStore";
import { PhoneOff, Mic, MicOff, Video, VideoOff, PhoneIncoming } from "lucide-react";
import clsx from "clsx";

function useCallMediaTick() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeCallMedia(() => setTick((t) => t + 1)), []);
}

function useElapsed(startedAt: number | null) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  if (!startedAt) return "00:00";
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallOverlay() {
  const call = useChatStore((s) => s.call);
  const callEndedReason = useChatStore((s) => s.callEndedReason);
  const clearCallEndedReason = useChatStore((s) => s.clearCallEndedReason);
  const contacts = useChatStore((s) => s.contacts);
  const acceptCall = useChatStore((s) => s.acceptCall);
  const rejectCall = useChatStore((s) => s.rejectCall);
  const endCall = useChatStore((s) => s.endCall);
  const toggleMute = useChatStore((s) => s.toggleMute);
  const toggleCamera = useChatStore((s) => s.toggleCamera);

  useCallMediaTick();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const contact = call ? contacts.find((c) => c.id === call.contactId) : undefined;
  const elapsed = useElapsed(call?.startedAt ?? null);
  const localStream = getLocalCallStream();
  const remoteStream = getRemoteCallStream();

  // The local/remote <video> elements only mount once call.phase === "active"
  // (see JSX below), but these effects can fire earlier — while localStream/
  // remoteStream first become available — when the ref is still null. Without
  // `call?.phase` in the deps, that assignment is silently dropped and never
  // retried once the element actually mounts. Including it forces a re-run
  // right when the element appears, by which point the ref is attached.
  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
  }, [localStream, call?.phase]);
  useEffect(() => {
    if (call?.kind === "video" && remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
    if (call?.kind === "audio" && remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;
  }, [remoteStream, call?.kind, call?.phase]);

  useEffect(() => {
    if (!callEndedReason) return;
    const t = setTimeout(clearCallEndedReason, 2500);
    return () => clearTimeout(t);
  }, [callEndedReason, clearCallEndedReason]);

  return (
    <>
      <AnimatePresence>
        {callEndedReason && !call && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center"
          >
            <div className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-white shadow-lg">{callEndedReason}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-0 z-50 mx-auto max-w-md">
        <AnimatePresence>
          {call && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto absolute inset-0 flex flex-col bg-gradient-to-b from-[#171106] via-[#0e0a03] to-black"
            >
              {call.kind === "video" && call.phase === "active" && (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
                />
              )}
              {call.kind === "audio" && <audio ref={remoteAudioRef} autoPlay />}

              <div className="relative flex flex-1 flex-col items-center justify-center gap-4 px-8 text-white">
                {(call.kind === "audio" || call.phase !== "active") &&
                  (contact?.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={contact.avatarDataUrl} alt="" className="h-24 w-24 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accentSoft text-3xl font-semibold text-accentDark">
                      {(contact?.username ?? "?").slice(0, 1).toUpperCase()}
                    </div>
                  ))}

                <div className="text-center">
                  <p className="text-lg font-semibold">@{contact?.username ?? "unknown"}</p>
                  <p className="mt-1 text-sm text-white/50">
                    {call.phase === "incoming" && `Incoming ${call.kind} call…`}
                    {call.phase === "outgoing" && "Calling…"}
                    {call.phase === "connecting" && "Connecting…"}
                    {call.phase === "active" && elapsed}
                  </p>
                </div>

                {call.kind === "video" && call.phase === "active" && (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute bottom-4 right-4 h-32 w-24 rounded-xl border-2 border-white/20 object-cover [transform:scaleX(-1)]"
                  />
                )}
              </div>

              <div className="relative z-10 flex items-center justify-center gap-4 pb-10">
                {call.phase === "incoming" ? (
                  <>
                    <button
                      onClick={rejectCall}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95"
                      title="Decline"
                    >
                      <PhoneOff size={22} />
                    </button>
                    <button
                      onClick={acceptCall}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg transition active:scale-95"
                      title="Accept"
                    >
                      <PhoneIncoming size={22} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={toggleMute}
                      className={clsx(
                        "flex h-12 w-12 items-center justify-center rounded-full transition",
                        call.muted ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"
                      )}
                      title={call.muted ? "Unmute" : "Mute"}
                    >
                      {call.muted ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    {call.kind === "video" && (
                      <button
                        onClick={toggleCamera}
                        className={clsx(
                          "flex h-12 w-12 items-center justify-center rounded-full transition",
                          call.cameraOff ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"
                        )}
                        title={call.cameraOff ? "Turn camera on" : "Turn camera off"}
                      >
                        {call.cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                      </button>
                    )}
                    <button
                      onClick={endCall}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition active:scale-95"
                      title="End call"
                    >
                      <PhoneOff size={22} />
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
