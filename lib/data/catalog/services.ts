import { CatalogItem } from "@/lib/types";

export const SERVICE_ITEMS: CatalogItem[] = [
  // Services
  {
    id: "svc-001",
    category: "services",
    providerId: "svc-homeclean",
    providerName: "HomeClean Pro",
    title: "Full Home Deep Cleaning",
    subtitle: "2BHK · 4 hours · 2 professionals",
    price: 1899,
    currency: "INR",
    attributes: { durationHours: 4, professionals: 2 },
    rating: 4.5,
  },
  {
    id: "svc-002",
    category: "services",
    providerId: "svc-fixit",
    providerName: "FixIt Electricians",
    title: "Electrician Visit (up to 1 hour)",
    subtitle: "Same-day slots available",
    price: 349,
    currency: "INR",
    attributes: { durationHours: 1 },
    rating: 4.3,
  },
];
