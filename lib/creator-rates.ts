export const rateChannels = {
  linkedin: { label: "LinkedIn", audience: "followers", unit: "post", rates: [300, 600, 900, 1800] },
  x: { label: "X", audience: "followers", unit: "post", rates: [300, 600, 900, 1800] },
  newsletter: { label: "Newsletter", audience: "subscribers", unit: "newsletter piece", rates: [300, 600, 900, 1800] },
  youtube: { label: "YouTube", audience: "subscribers", unit: "video", rates: [500, 1000, 1500, 3000] },
} as const;
export type RateChannel = keyof typeof rateChannels;
export const audienceAnchors = [1000, 5000, 10000, 25000] as const;
export function estimateCreatorRate(channel: RateChannel, audience: number): number | null {
  if (!Number.isSafeInteger(audience) || audience < 1000 || audience > 25000) return null;
  const rates = rateChannels[channel].rates;
  const lower = audience <= 5000 ? 0 : audience <= 10000 ? 1 : 2;
  const fraction = (audience - audienceAnchors[lower]) / (audienceAnchors[lower + 1] - audienceAnchors[lower]);
  return rates[lower] + fraction * (rates[lower + 1] - rates[lower]);
}
