import { Laptop, UtensilsCrossed, ShoppingCart, Shirt, Hotel, Car, Wrench, LucideIcon } from "lucide-react";
import { ServiceCategory } from "@/lib/types";

export const CATEGORY_ICON: Record<ServiceCategory, LucideIcon> = {
  electronics: Laptop,
  food: UtensilsCrossed,
  grocery: ShoppingCart,
  fashion: Shirt,
  hotels: Hotel,
  rides: Car,
  services: Wrench,
};
