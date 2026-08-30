import Link from "next/link";
import clsx from "clsx";
import { Users, Coffee, ShieldCheck, BedDouble } from "lucide-react";
import { CatalogItem } from "@/lib/types";

export default function RoomRow({
  room,
  guests,
  checkIn,
  checkOut,
}: {
  room: CatalogItem;
  guests: number;
  checkIn: string;
  checkOut: string;
}) {
  const fits = (room.maxGuests ?? 99) >= guests;
  const bookHref = `/explore/hotels/${room.providerId}/book?room=${room.id}&checkin=${checkIn}&checkout=${checkOut}&guests=${guests}`;

  return (
    <div className={clsx("rounded-xl2 border bg-white p-3 shadow-sm", fits ? "border-black/5" : "border-black/5 opacity-60")}>
      <p className="text-sm font-semibold text-ink">{room.title}</p>
      {room.subtitle && <p className="mt-0.5 text-xs text-ink/50">{room.subtitle}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink/60">
        {room.bedType && (
          <span className="inline-flex items-center gap-1">
            <BedDouble size={12} /> {room.bedType}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Users size={12} /> Up to {room.maxGuests ?? "—"} guests
        </span>
        {room.breakfastIncluded && (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <Coffee size={12} /> Breakfast included
          </span>
        )}
      </div>

      <p className={clsx("mt-1.5 text-[11px] font-medium", room.freeCancellation ? "text-emerald-700" : "text-ink/45")}>
        <ShieldCheck size={11} className="mr-1 inline" />
        {room.freeCancellation ? "Free cancellation" : "Non-refundable"}
      </p>

      {!fits && <p className="mt-1.5 text-[11px] font-medium text-red-600">Doesn&apos;t fit {guests} guests</p>}

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-base font-bold text-ink">₹{room.price.toLocaleString("en-IN")}</p>
          <p className="text-[10px] text-ink/40">per night, excl. taxes</p>
        </div>
        {fits ? (
          <Link
            href={bookHref}
            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-ink transition hover:brightness-95"
          >
            Reserve
          </Link>
        ) : (
          <span className="rounded-full bg-black/5 px-4 py-2 text-xs font-medium text-ink/35">Reserve</span>
        )}
      </div>
    </div>
  );
}
