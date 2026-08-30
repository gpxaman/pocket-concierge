import { FilterSettings } from "@/lib/types";

export const NEUTRAL_FILTER: FilterSettings = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hueRotate: 0,
  sepia: 0,
  grayscale: 0,
};

export const BUILTIN_PRESETS: (FilterSettings & { id: string; name: string })[] = [
  { id: "none", name: "Normal", ...NEUTRAL_FILTER },
  { id: "warm", name: "Warm", brightness: 106, contrast: 104, saturation: 122, hueRotate: -8, sepia: 18, grayscale: 0 },
  { id: "cool", name: "Cool", brightness: 102, contrast: 106, saturation: 112, hueRotate: 14, sepia: 0, grayscale: 0 },
  { id: "mono", name: "Mono", brightness: 106, contrast: 114, saturation: 0, hueRotate: 0, sepia: 0, grayscale: 100 },
  { id: "vintage", name: "Vintage", brightness: 102, contrast: 92, saturation: 82, hueRotate: -4, sepia: 38, grayscale: 0 },
  { id: "vivid", name: "Vivid", brightness: 104, contrast: 112, saturation: 150, hueRotate: 0, sepia: 0, grayscale: 0 },
];

export function filterToCss(f: FilterSettings): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%) grayscale(${f.grayscale}%)`;
}
