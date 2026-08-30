export interface RideTier {
  id: string;
  name: string;
  tagline: string;
  emoji: string;
  capacity: number;
  baseFare: number;
  perKmRate: number;
}

export const RIDE_TIERS: RideTier[] = [
  { id: "auto", name: "Auto", tagline: "Cheap & quick", emoji: "🛺", capacity: 3, baseFare: 25, perKmRate: 11 },
  { id: "mini", name: "Mini", tagline: "Everyday rides", emoji: "🚗", capacity: 4, baseFare: 45, perKmRate: 14 },
  { id: "sedan", name: "Sedan", tagline: "Extra comfy", emoji: "🚙", capacity: 4, baseFare: 65, perKmRate: 18 },
  { id: "xl", name: "XL", tagline: "For the squad", emoji: "🚐", capacity: 6, baseFare: 95, perKmRate: 24 },
];

const FIRST_NAMES = ["Ravi", "Priya", "Arjun", "Sneha", "Vikram", "Ananya", "Karan", "Isha", "Rohit", "Meera"];
const VEHICLE_MODELS: Record<string, string[]> = {
  auto: ["Bajaj RE", "TVS King", "Piaggio Ape"],
  mini: ["Maruti Swift", "Hyundai i10", "Tata Tiago"],
  sedan: ["Honda City", "Hyundai Verna", "Skoda Slavia"],
  xl: ["Toyota Innova", "Maruti Ertiga", "Kia Carens"],
};
const PLATE_STATES = ["KA", "DL", "MH", "TN", "UP"];

export function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Deterministic mock distance so the same pickup/destination pair always
 * quotes the same fare in one session — feels real instead of jumpy. */
export function estimateDistanceKm(pickup: string, destination: string): number {
  const h = hashString(`${pickup.toLowerCase()}|${destination.toLowerCase()}`);
  return Math.round((2 + (h % 1400) / 100) * 10) / 10; // 2.0 - 16.0 km
}

export function fareFor(tier: RideTier, distanceKm: number, surge: number): number {
  return Math.round((tier.baseFare + tier.perKmRate * distanceKm) * surge);
}

/** Small, infrequent surge so it's not distracting but still feels alive. */
export function surgeFor(pickup: string, destination: string): number {
  const h = hashString(`surge|${pickup.toLowerCase()}|${destination.toLowerCase()}`);
  return h % 5 === 0 ? 1.3 : 1;
}

export function randomDriver(tierId: string): { name: string; vehicle: string; plate: string; rating: number } {
  const name = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const models = VEHICLE_MODELS[tierId] ?? VEHICLE_MODELS.mini;
  const vehicle = models[Math.floor(Math.random() * models.length)];
  const state = PLATE_STATES[Math.floor(Math.random() * PLATE_STATES.length)];
  const plate = `${state} ${(10 + Math.floor(Math.random() * 89)).toString().padStart(2, "0")} ${String.fromCharCode(
    65 + Math.floor(Math.random() * 26)
  )}${String.fromCharCode(65 + Math.floor(Math.random() * 26))} ${1000 + Math.floor(Math.random() * 8999)}`;
  const rating = Math.round((4.3 + Math.random() * 0.65) * 10) / 10;
  return { name, vehicle, plate, rating };
}

export const PLACE_SUGGESTIONS = ["Home", "Work", "Airport", "Railway Station", "City Mall"];
