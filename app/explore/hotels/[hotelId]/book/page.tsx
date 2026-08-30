import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HOTELS, findHotel } from "@/lib/data/hotels";
import HotelBookingView from "@/components/HotelBookingView";

export function generateStaticParams() {
  return HOTELS.map((h) => ({ hotelId: h.id }));
}

export default async function HotelBookPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const hotel = findHotel(hotelId);
  if (!hotel) notFound();

  return (
    <Suspense fallback={<div className="px-5 pt-6 text-sm text-ink/40">Loading…</div>}>
      <HotelBookingView hotel={hotel} />
    </Suspense>
  );
}
