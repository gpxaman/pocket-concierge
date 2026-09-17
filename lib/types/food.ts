// Food-delivery live-tracking domain — the same shape of problem as rides
// (lib/types/rides.ts), independent because a delivery partner and a ride
// driver carry different fields and a food order has no pickup/drop points
// (it tracks restaurant -> address instead of a two-point map).

export type FoodOrderPhase = "placed" | "preparing" | "assigned" | "picked_up" | "delivered" | "cancelled";

export interface DeliveryPartner {
  name: string;
  vehicle: string;
  rating: number;
}

export interface ActiveFoodOrder {
  id: string;
  transactionId: string;
  phase: FoodOrderPhase;
  itemTitle: string;
  restaurantName: string;
  address: string;
  fare: number;
  partner: DeliveryPartner | null;
  etaMinutes: number | null;
  placedAt: number;
  pickedUpAt: number | null;
  deliveredAt: number | null;
  partnerRating: number | null;
}
