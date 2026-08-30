export const DELIVERY_FEE = 25;
export const PLATFORM_FEE = 6;

const PARTNER_NAMES = ["Sanjay", "Farhan", "Deepak", "Rekha", "Suresh", "Naveen", "Pooja", "Manoj"];
const VEHICLES = ["Bike", "Scooter", "Bicycle"];

export function randomDeliveryPartner(): { name: string; vehicle: string; rating: number } {
  return {
    name: PARTNER_NAMES[Math.floor(Math.random() * PARTNER_NAMES.length)],
    vehicle: VEHICLES[Math.floor(Math.random() * VEHICLES.length)],
    rating: Math.round((4.2 + Math.random() * 0.75) * 10) / 10,
  };
}

export const ADDRESS_SUGGESTIONS = ["Home", "Work", "Hostel", "PG"];
