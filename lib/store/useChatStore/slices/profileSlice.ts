// Owns no state of its own — writes into IdentitySlice's `identity` and
// re-publishes it to the relay directory, since a stale phone/avatar there
// would keep showing up in other people's lookups.
import { StateCreator } from "zustand";
import { ChatState, ProfileSlice } from "../types";
import { reclaimUsernameIfAny } from "../internal";

export const createProfileSlice: StateCreator<ChatState, [], [], ProfileSlice> = (set, get) => ({
  setOwnPhone: (phone) => {
    set((s) => ({ identity: s.identity ? { ...s.identity, phone: phone.trim() } : s.identity }));
    reclaimUsernameIfAny(get);
  },
  setOwnAvatar: (dataUrl) => {
    set((s) => ({ identity: s.identity ? { ...s.identity, avatarDataUrl: dataUrl } : s.identity }));
    reclaimUsernameIfAny(get);
  },
});
