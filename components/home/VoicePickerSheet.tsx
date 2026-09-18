"use client";

import { Check, Volume2 } from "lucide-react";
import clsx from "clsx";

export default function VoicePickerSheet({
  voices,
  selectedVoiceURI,
  onChoose,
  onPreview,
  onClose,
}: {
  voices: SpeechSynthesisVoice[];
  selectedVoiceURI: string | null;
  onChoose: (uri: string | null) => void;
  onPreview: (voice: SpeechSynthesisVoice) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end bg-black/60" onClick={onClose}>
      <div className="mx-auto max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-[#171106] p-5 pb-8 text-white" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">Choose a voice</p>
        <p className="mt-0.5 text-xs text-white/40">Uses your browser&apos;s built-in voices — tap one to preview it.</p>
        {voices.length === 0 ? (
          <p className="mt-4 text-xs text-white/40">No voices available in this browser yet.</p>
        ) : (
          <div className="mt-3 space-y-1">
            <button
              onClick={() => onChoose(null)}
              className={clsx(
                "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm",
                !selectedVoiceURI ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
              )}
            >
              Default
              {!selectedVoiceURI && <Check size={15} className="text-accent" />}
            </button>
            {voices
              .filter((v) => v.lang.startsWith("en"))
              .map((v) => (
                <button
                  key={v.voiceURI}
                  onClick={() => {
                    onChoose(v.voiceURI);
                    onPreview(v);
                  }}
                  className={clsx(
                    "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm",
                    selectedVoiceURI === v.voiceURI ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">
                    {v.name} <span className="text-white/35">· {v.lang}</span>
                  </span>
                  {selectedVoiceURI === v.voiceURI ? (
                    <Check size={15} className="shrink-0 text-accent" />
                  ) : (
                    <Volume2 size={14} className="shrink-0 text-white/25" />
                  )}
                </button>
              ))}
          </div>
        )}
        <button onClick={onClose} className="mt-4 flex w-full items-center justify-center py-2 text-xs text-white/40">
          Done
        </button>
      </div>
    </div>
  );
}
