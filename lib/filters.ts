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
  { id: "bw-contrast", name: "B&W+", brightness: 102, contrast: 132, saturation: 0, hueRotate: 0, sepia: 0, grayscale: 100 },
  { id: "golden-hour", name: "Golden Hour", brightness: 108, contrast: 102, saturation: 128, hueRotate: -12, sepia: 30, grayscale: 0 },
  { id: "noir", name: "Noir", brightness: 88, contrast: 128, saturation: 20, hueRotate: 0, sepia: 8, grayscale: 78 },
  { id: "faded", name: "Faded", brightness: 110, contrast: 84, saturation: 68, hueRotate: 6, sepia: 14, grayscale: 0 },
  { id: "cool-blue", name: "Cool Blue", brightness: 100, contrast: 108, saturation: 118, hueRotate: 26, sepia: 0, grayscale: 0 },
  { id: "night", name: "Night", brightness: 82, contrast: 118, saturation: 90, hueRotate: 198, sepia: 0, grayscale: 0 },
  { id: "dreamy", name: "Dreamy", brightness: 114, contrast: 90, saturation: 104, hueRotate: -6, sepia: 22, grayscale: 0 },
  { id: "punch", name: "Punch", brightness: 106, contrast: 120, saturation: 160, hueRotate: 0, sepia: 0, grayscale: 0 },
];

export function filterToCss(f: FilterSettings): string {
  return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturation}%) hue-rotate(${f.hueRotate}deg) sepia(${f.sepia}%) grayscale(${f.grayscale}%)`;
}
