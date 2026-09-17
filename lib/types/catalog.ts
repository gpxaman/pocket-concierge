// Shopping domain: the shared product/listing shape plus its two
// presentation-layer companions (Restaurant, Hotel) that group CatalogItems
// under one card in Explore. Kept separate from Restaurant/Hotel data
// itself (lib/data/*) — these are just the field contracts.

export type ServiceCategory =
  | "electronics"
  | "food"
  | "grocery"
  | "fashion"
  | "hotels"
  | "rides"
  | "services";

export interface CatalogItem {
  id: string;
  category: ServiceCategory;
  providerId: string;
  providerName: string;
  title: string;
  subtitle?: string;
  price: number;
  currency: "INR";
  attributes: Record<string, string | number | boolean>;
  rating?: number;
  etaMinutes?: number;
  location?: string;
  /** First-class veg/non-veg flag (food items) — mirrors the Zomato/DoorDash veg dot. */
  veg?: boolean;
  /** Strike-through original price, shown alongside `price` when discounted (grocery, Blinkit-style). */
  mrp?: number;
  /** Menu section a food item belongs to, e.g. "Starters", "Mains" (Zomato/DoorDash-style categorized menu). */
  menuSection?: string;
  /** Highlighted as a bestseller on the restaurant menu. */
  isBestseller?: boolean;
  /** Pack size, e.g. "500 g", "1 L" (grocery only). */
  weight?: string;
  /** Which grocery shelf/category this product belongs to (Blinkit-style subcategory). */
  groceryCategoryId?: string;
  /** Max occupancy for a hotel room. */
  maxGuests?: number;
  /** e.g. "1 King Bed", "2 Queen Beds" (hotel rooms only). */
  bedType?: string;
  /** Breakfast included in the room rate. */
  breakfastIncluded?: boolean;
  /** Free cancellation up to check-in vs. non-refundable (Booking.com-style policy flag). */
  freeCancellation?: boolean;
}

export interface Restaurant {
  id: string; // matches the providerId used by this restaurant's food CatalogItems
  name: string;
  cuisines: string[];
  rating: number;
  ratingCount: number;
  deliveryEtaMinutes: number;
  priceForTwo: number;
  area: string;
  isPureVeg: boolean;
  offer?: string;
  /** Placeholder banner gradient — no real photos in this prototype. */
  gradientFrom: string;
  gradientTo: string;
}

export interface GroceryCategoryMeta {
  id: string;
  label: string;
}

export interface Hotel {
  id: string; // matches the providerId used by this hotel's room CatalogItems
  name: string;
  /** Hotel class, 1-5 stars. */
  starRating: number;
  /** Booking.com-style guest review score, 0-10. */
  reviewScore: number;
  reviewCount: number;
  area: string;
  address: string;
  amenities: string[];
  description: string;
  /** Placeholder banner gradient — no real photos in this prototype. */
  gradientFrom: string;
  gradientTo: string;
}
