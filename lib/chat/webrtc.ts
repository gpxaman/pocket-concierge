// WebRTC quality configuration for 1:1 audio/video calls. Media itself never
// touches the relay — it flows directly (or via STUN-assisted NAT traversal)
// between the two browsers, DTLS-SRTP encrypted by the browser's WebRTC
// stack. The relay only ever forwards SDP/ICE signaling (see
// server/chat-relay.mjs's call-* passthrough), not audio/video bytes.

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// "Highest quality" within what a browser will realistically negotiate:
// 1080p30 video with generous bitrate headroom, full-band stereo-capable
// audio with the standard cleanup pipeline on. Actual delivered quality is
// still capped by both peers' cameras/mics and the network path between
// them — there's no TURN relay configured here, so calls across strict
// NATs/firewalls (common on corporate wifi) may fail to connect; that's a
// known gap for a demo-scope relay, not something client-side config fixes.
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1920, max: 1920 },
  height: { ideal: 1080, max: 1080 },
  frameRate: { ideal: 30, max: 60 },
  facingMode: "user",
};

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 2,
};

export function createPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: ICE_SERVERS });
}

/** Raises the sender's bitrate ceiling above the browser's conservative
 * default so 1080p video actually gets to use the resolution it negotiated. */
export async function applyHighQualityEncoding(pc: RTCPeerConnection): Promise<void> {
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    try {
      const params = sender.getParameters();
      if (!params.encodings || params.encodings.length === 0) params.encodings = [{}];
      params.encodings[0].maxBitrate = sender.track.kind === "video" ? 3_000_000 : 128_000;
      if (sender.track.kind === "video") params.encodings[0].priority = "high";
      await sender.setParameters(params);
    } catch {
      // setParameters can reject before the first negotiation completes on
      // some browsers — harmless, the default bitrate still works.
    }
  }
}
