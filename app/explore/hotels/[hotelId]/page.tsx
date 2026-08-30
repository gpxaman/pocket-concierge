import { Suspense } from "react";
import { notFound } from "next/navigation";
import { HOTELS, findHotel } from "@/lib/data/hotels";
import { roomsByHotel } from "@/lib/data/catalog";
import HotelDetailView from "@/components/HotelDetailView";

export function generateStaticParams() {
  return HOTELS.map((h) => ({ hotelId: h.id }));
}

export default async function HotelPage({ params }: { params: Promise<{ hotelId: string }> }) {
  const { hotelId } = await params;
  const hotel = findHotel(hotelId);
  if (!hotel) notFound();

  const rooms = roomsByHotel(hotelId);

  return (
    <Suspense fallback={<div className="px-5 pt-6 text-sm text-ink/40">Loading…</div>}>
      <HotelDetailView hotel={hotel} rooms={rooms} />
    </Suspense>
  );
}
