import type { MarketFocus } from "@/lib/site-brief";

function first(input: string[]): string {
  return input[0]?.trim() ?? "";
}

function second(input: string[]): string {
  return input[1]?.trim() ?? "";
}

function serviceLine(primaryServices: string[]): string {
  return first(primaryServices) || "digital growth services";
}

/** User-visible location statement templates from location-statement rules. */
export function buildGeoAreaNoteVisible(input: {
  marketFocus: MarketFocus;
  serviceArea: string[];
  primaryServices: string[];
  targetAudience: string;
}): string {
  const city = first(input.serviceArea) || "your market";
  const metro = second(input.serviceArea) || "your metro area";
  const service = serviceLine(input.primaryServices);
  const audience = input.targetAudience.trim() || "growth-focused teams";

  switch (input.marketFocus) {
    case "local":
      return `We serve ${city} and ${metro} with ${service}, supporting nationwide growth goals.`;
    case "regional":
      return `Serving ${input.serviceArea.join(", ") || "regional"} businesses with ${service}.`;
    case "national":
      return `Delivering ${service} nationwide for ${audience}.`;
    case "dual":
      return `In-market execution for ${city} and ${metro} with national reach for growth teams.`;
    default:
      return `Delivering ${service} for ${audience}.`;
  }
}
