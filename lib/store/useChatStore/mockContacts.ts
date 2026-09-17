// Demo/prototype only — seeded once for a brand-new identity so the Chat UI
// has something to look at before you've paired with a real second device.
// Never real peers: sendMessage/startCall both treat isMock contacts as
// "not actually reachable" rather than trying to hit the relay with them.
import { ChatMessageStatus } from "./types";

export const HOUR = 60 * 60 * 1000;

export const MOCK_CONTACTS: {
  username: string;
  phone: string;
  messages: { direction: "in" | "out"; text: string; hoursAgo: number; status: ChatMessageStatus }[];
}[] = [
  {
    username: "priya_sharma",
    phone: "+91 98765 11223",
    messages: [
      { direction: "in", text: "Hey! Are we still on for tomorrow?", hoursAgo: 2, status: "received" },
      { direction: "out", text: "Yes, 6pm works for me", hoursAgo: 1.9, status: "delivered" },
    ],
  },
  {
    username: "rahul_verma",
    phone: "+91 91234 56780",
    messages: [{ direction: "in", text: "Sent you the files, check when you're free", hoursAgo: 20, status: "received" }],
  },
  {
    username: "ananya.k",
    phone: "+91 99887 66554",
    messages: [
      { direction: "out", text: "Happy birthday! 🎉", hoursAgo: 30, status: "delivered" },
      { direction: "in", text: "Thank you so much!! 😊", hoursAgo: 29.5, status: "received" },
    ],
  },
  { username: "dev_patel", phone: "+91 90000 12345", messages: [] },
];
