import type { Metadata } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import CallOverlay from "@/components/CallOverlay";
import ActiveRideBar from "@/components/ActiveRideBar";
import CartFloatingBar from "@/components/CartFloatingBar";

export const metadata: Metadata = {
  title: "Pocket Concierge",
  description: "AI-native super app — personal pocket concierge (demo)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto min-h-screen max-w-md bg-paper pb-20 shadow-[0_0_40px_rgba(0,0,0,0.04)]">
          {children}
        </div>
        <BottomNav />
        <ActiveRideBar />
        <CartFloatingBar />
        <CallOverlay />
      </body>
    </html>
  );
}
