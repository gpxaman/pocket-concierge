export interface Driver {
  name: string;
  vehicleModel: string;
  vehicleNumber: string;
  rating: number;
  /** Fraction of ride offers this driver accepts — used by the matching simulation. */
  acceptanceRate: number;
}

// Purely mock — no real dispatch/matching, just enough to make the ride
// matching + "driver assigned" flow feel real.
const ROSTER: Record<string, Driver[]> = {
  bike: [
    { name: "Ravi Kumar", vehicleModel: "Honda Activa", vehicleNumber: "KA 05 AB 4521", rating: 4.7, acceptanceRate: 0.85 },
    { name: "Suresh Patil", vehicleModel: "TVS Jupiter", vehicleNumber: "KA 03 CJ 7789", rating: 4.6, acceptanceRate: 0.78 },
    { name: "Arjun Nair", vehicleModel: "Bajaj Pulsar", vehicleNumber: "KA 41 EF 1023", rating: 4.8, acceptanceRate: 0.9 },
  ],
  auto: [
    { name: "Mahesh Reddy", vehicleModel: "Bajaj Auto", vehicleNumber: "KA 02 MK 6634", rating: 4.5, acceptanceRate: 0.75 },
    { name: "Irfan Sheikh", vehicleModel: "Piaggio Ape", vehicleNumber: "KA 09 QW 2210", rating: 4.4, acceptanceRate: 0.7 },
  ],
  standard: [
    { name: "Vikram Singh", vehicleModel: "Maruti Dzire", vehicleNumber: "KA 01 HT 3345", rating: 4.6, acceptanceRate: 0.82 },
    { name: "Deepak Gowda", vehicleModel: "Honda Amaze", vehicleNumber: "KA 51 BN 9982", rating: 4.7, acceptanceRate: 0.88 },
  ],
  premium: [
    { name: "Sanjay Rao", vehicleModel: "Toyota Innova Crysta", vehicleNumber: "KA 03 XZ 5567", rating: 4.9, acceptanceRate: 0.93 },
    { name: "Naveen Kumar", vehicleModel: "Honda City", vehicleNumber: "KA 05 LP 8814", rating: 4.8, acceptanceRate: 0.89 },
  ],
};

export function driversForType(rideTypeId: string): Driver[] {
  return ROSTER[rideTypeId] ?? ROSTER.standard;
}
