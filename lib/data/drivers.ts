export interface Driver {
  name: string;
  vehicleModel: string;
  vehicleNumber: string;
  rating: number;
}

// Purely mock — no real dispatch/matching, just enough to make the "driver
// assigned" confirmation screen feel real. Picked pseudo-randomly per booking.
const ROSTER: Record<string, Driver[]> = {
  bike: [
    { name: "Ravi Kumar", vehicleModel: "Honda Activa", vehicleNumber: "KA 05 AB 4521", rating: 4.7 },
    { name: "Suresh Patil", vehicleModel: "TVS Jupiter", vehicleNumber: "KA 03 CJ 7789", rating: 4.6 },
    { name: "Arjun Nair", vehicleModel: "Bajaj Pulsar", vehicleNumber: "KA 41 EF 1023", rating: 4.8 },
  ],
  auto: [
    { name: "Mahesh Reddy", vehicleModel: "Bajaj Auto", vehicleNumber: "KA 02 MK 6634", rating: 4.5 },
    { name: "Irfan Sheikh", vehicleModel: "Piaggio Ape", vehicleNumber: "KA 09 QW 2210", rating: 4.4 },
  ],
  standard: [
    { name: "Vikram Singh", vehicleModel: "Maruti Dzire", vehicleNumber: "KA 01 HT 3345", rating: 4.6 },
    { name: "Deepak Gowda", vehicleModel: "Honda Amaze", vehicleNumber: "KA 51 BN 9982", rating: 4.7 },
  ],
  premium: [
    { name: "Sanjay Rao", vehicleModel: "Toyota Innova Crysta", vehicleNumber: "KA 03 XZ 5567", rating: 4.9 },
    { name: "Naveen Kumar", vehicleModel: "Honda City", vehicleNumber: "KA 05 LP 8814", rating: 4.8 },
  ],
};

export function pickDriver(rideTypeId: string): Driver {
  const pool = ROSTER[rideTypeId] ?? ROSTER.standard;
  return pool[Math.floor(Math.random() * pool.length)];
}
