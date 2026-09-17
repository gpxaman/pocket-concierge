import { CatalogItem } from "@/lib/types";

export const FASHION_ITEMS: CatalogItem[] = [
  // Fashion
  {
    id: "fas-001",
    category: "fashion",
    providerId: "fas-urbanthread",
    providerName: "Urban Thread",
    title: "Black Formal Slim-Fit Shirt",
    subtitle: "Cotton blend, full sleeve",
    price: 1299,
    currency: "INR",
    attributes: { color: "black", fit: "slim", size: "S,M,L,XL" },
    rating: 4.2,
  },
  {
    id: "fas-002",
    category: "fashion",
    providerId: "fas-urbanthread",
    providerName: "Urban Thread",
    title: "Navy Bomber Jacket",
    subtitle: "Water-resistant shell",
    price: 2799,
    currency: "INR",
    attributes: { color: "navy", fit: "regular", size: "M,L,XL" },
    rating: 4.5,
  },
];
