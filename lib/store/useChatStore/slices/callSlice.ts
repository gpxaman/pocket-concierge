import { StateCreator } from "zustand";
import { AUDIO_CONSTRAINTS, VIDEO_CONSTRAINTS, applyHighQualityEncoding, createPeerConnection } from "@/lib/chat/webrtc";
import { transport } from "../transport";
import { CallSlice, ChatState } from "../types";
import { endCallLocally, notifyCallMedia, sendSignal, teardownCallResources, wirePeerConnection } from "../internal";

export const createCallSlice: StateCreator<ChatState, [], [], CallSlice> = (set, get) => ({
  call: null,
  callEndedReason: null,

  startCall: async (contactId, kind) => {
    if (get().call) return;
    const contact = get().contacts.find((c) => c.id === contactId);
    if (!contact || !transport.socket || transport.socket.readyState !== WebSocket.OPEN) return;
    if (contact.isMock) {
      // Not a real peer — skip the real mic/camera prompt entirely rather
      // than asking for permissions just to fail with call-unavailable a
      // moment later.
      set({ callEndedReason: "This is a demo contact — no one to call." });
      return;
    }

    set({ call: { contactId, kind, phase: "outgoing", startedAt: null, muted: false, cameraOff: false }, callEndedReason: null });

    try {
      transport.localStream = await navigator.mediaDevices.getUserMedia({
        video: kind === "video" ? VIDEO_CONSTRAINTS : false,
        audio: AUDIO_CONSTRAINTS,
      });
      notifyCallMedia();

      const pc = createPeerConnection();
      transport.peerConnection = pc;
      wirePeerConnection(set, get, pc, contactId);
      transport.localStream.getTracks().forEach((t) => pc.addTrack(t, transport.localStream!));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await applyHighQualityEncoding(pc);
      sendSignal({ type: "call-offer", to: contactId, kind, sdp: pc.localDescription });
    } catch (err) {
      console.warn("[call] failed to start", err);
      teardownCallResources();
      set({ call: null, callEndedReason: "Couldn't access camera/microphone" });
    }
  },

  acceptCall: async () => {
    const call = get().call;
    if (!call || call.phase !== "incoming" || !transport.pendingOfferSdp) return;

    try {
      transport.localStream = await navigator.mediaDevices.getUserMedia({
        video: call.kind === "video" ? VIDEO_CONSTRAINTS : false,
        audio: AUDIO_CONSTRAINTS,
      });
      notifyCallMedia();

      const pc = createPeerConnection();
      transport.peerConnection = pc;
      wirePeerConnection(set, get, pc, call.contactId);
      transport.localStream.getTracks().forEach((t) => pc.addTrack(t, transport.localStream!));

      await pc.setRemoteDescription(transport.pendingOfferSdp);
      for (const c of transport.pendingRemoteIce) await pc.addIceCandidate(c).catch(() => {});
      transport.pendingRemoteIce = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await applyHighQualityEncoding(pc);
      sendSignal({ type: "call-answer", to: call.contactId, sdp: pc.localDescription });

      set((s) => (s.call ? { call: { ...s.call, phase: "connecting" } } : {}));
    } catch (err) {
      console.warn("[call] failed to accept", err);
      endCallLocally(set, get, true);
      set({ callEndedReason: "Couldn't access camera/microphone" });
    }
  },

  rejectCall: () => endCallLocally(set, get, true),
  endCall: () => endCallLocally(set, get, true),

  toggleMute: () => {
    const track = transport.localStream?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set((s) => (s.call ? { call: { ...s.call, muted: !track.enabled } } : {}));
  },

  toggleCamera: () => {
    const track = transport.localStream?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    set((s) => (s.call ? { call: { ...s.call, cameraOff: !track.enabled } } : {}));
  },

  clearCallEndedReason: () => set({ callEndedReason: null }),
});
