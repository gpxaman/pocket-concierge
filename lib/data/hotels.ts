import { Hotel } from "@/lib/types";

// id matches the `providerId` used by this hotel's room CatalogItems in
// lib/data/catalog.ts. No real photos in this prototype — gradientFrom/To
// drive a placeholder banner tile instead (see HotelCard).
export const HOTELS: Hotel[] = [
  {
    id: "hotel-lakeview",
    name: "Lakeview Residency",
    starRating: 4,
    reviewScore: 8.6,
    reviewCount: 1240,
    area: "MG Road",
    address: "14 Lake Terrace Road, MG Road",
    amenities: ["Free WiFi", "Breakfast", "AC", "Parking", "24-hour front desk"],
    description: "A comfortable mid-range stay overlooking the lake, minutes from MG Road's shopping and dining.",
    gradientFrom: "#0ea5e9",
    gradientTo: "#0c4a6e",
  },
  {
    id: "hotel-parkgrand",
    name: "Park Grand",
    starRating: 5,
    reviewScore: 9.1,
    reviewCount: 2860,
    area: "Whitefield",
    address: "88 Park Avenue, Whitefield",
    amenities: ["Free WiFi", "Rooftop Pool", "Spa", "Gym", "Breakfast", "Valet Parking"],
    description: "A five-star retreat with a rooftop pool and full spa, set in the heart of Whitefield's tech corridor.",
    gradientFrom: "#a855f7",
    gradientTo: "#4c1d95",
  },
  {
    id: "hotel-urbannest",
    name: "Urban Nest Inn",
    starRating: 3,
    reviewScore: 7.8,
    reviewCount: 640,
    area: "Koramangala",
    address: "22 5th Block, Koramangala",
    amenities: ["Free WiFi", "AC", "24-hour front desk"],
    description: "A no-frills budget stay right in Koramangala, walking distance to cafes and nightlife.",
    gradientFrom: "#64748b",
    gradientTo: "#1e293b",
  },
  {
    id: "hotel-grandmeridian",
    name: "The Grand Meridian",
    starRating: 5,
    reviewScore: 9.4,
    reviewCount: 3510,
    area: "MG Road",
    address: "1 Meridian Circle, MG Road",
    amenities: ["Free WiFi", "Pool", "Spa", "Gym", "Breakfast", "Airport Shuttle", "Valet Parking"],
    description: "The city's landmark luxury address — marble lobbies, a full-service spa, and skyline views.",
    gradientFrom: "#f59e0b",
    gradientTo: "#78350f",
  },
];

export function findHotel(id: string): Hotel | undefined {
  return HOTELS.find((h) => h.id === id);
}

export function reviewLabel(score: number): string {
  if (score >= 9.5) return "Exceptional";
  if (score >= 9.0) return "Wonderful";
  if (score >= 8.5) return "Excellent";
  if (score >= 8.0) return "Very Good";
  if (score >= 7.0) return "Good";
  return "Pleasant";
}
