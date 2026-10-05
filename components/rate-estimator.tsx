"use client";

import { useState, type CSSProperties } from "react";
import { Mail, Play, Check, ArrowUpRight } from "lucide-react";
import { audienceAnchors, estimateCreatorRate, rateChannels, type RateChannel } from "@/lib/creator-rates";

function ChannelIcon({ channel }: { channel: RateChannel }) {
  if (channel === "linkedin") return <span className="rate-brand-icon" aria-hidden="true">in</span>;
  if (channel === "x") return <span className="rate-brand-icon rate-x-icon" aria-hidden="true">𝕏</span>;
  return channel === "youtube" ? <Play size={18} aria-hidden="true"/> : <Mail size={18} aria-hidden="true"/>;
}
const dollars = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export function RateEstimator() {
  const [channel, setChannel] = useState<RateChannel>("linkedin");
  const [audience, setAudience] = useState("5000");
  const config = rateChannels[channel];
  const count = Number(audience);
  const estimate = estimateCreatorRate(channel, count);
  const minimumAudience = audienceAnchors[0];
  const maximumAudience = audienceAnchors[audienceAnchors.length - 1];
  return <section className="rate-estimator" aria-label="Creator rate calculator">
    <div className="rate-channel-switch" role="group" aria-label="Choose channel">
      {(Object.keys(rateChannels) as RateChannel[]).map((key) => {
        return <button key={key} type="button" aria-pressed={channel === key} onClick={() => setChannel(key)}><ChannelIcon channel={key}/>{rateChannels[key].label}</button>;
      })}
    </div>
    <div className="rate-layout">
      <div className="rate-inputs">
        <span className="rate-step">01 / Choose your channel above</span>
        <div className="rate-audience-heading"><label htmlFor="rate-audience">How big is their audience?</label><span>02</span></div>
        <div className="rate-number-wrap"><input id="rate-audience" type="number" min={minimumAudience} max={maximumAudience} step="1" value={audience} onChange={(event) => setAudience(event.target.value)} aria-describedby="rate-audience-help"/><span>{config.audience}</span></div>
        <input className="rate-slider" aria-label={`${config.label} audience slider`} type="range" min={minimumAudience} max={maximumAudience} step="1" value={Math.min(maximumAudience, Math.max(minimumAudience, count || minimumAudience))} onChange={(event) => setAudience(event.target.value)} style={{ "--rate-progress": `${Math.min(100, Math.max(0, (count - minimumAudience) / (maximumAudience - minimumAudience) * 100)) || 0}%` } as CSSProperties}/>
        <div className="rate-presets" aria-label="Example audience sizes">{audienceAnchors.map((value) => <button type="button" key={value} aria-pressed={count === value} onClick={() => setAudience(String(value))}>{value.toLocaleString("en-US")}</button>)}</div>
        <p id="rate-audience-help" className="rate-help">Slide to explore, or type an exact number.</p>
        <div className="rate-deliverable"><span className="rate-deliverable-icon"><ArrowUpRight size={22}/></span><div><strong>Expertise. Not a product plug.</strong><p>An original teardown, tutorial or analysis — created and published by the creator.</p></div></div>
        <details className="rate-reference"><summary>Add a profile reference</summary><label htmlFor="rate-profile" className="sr-only">Creator profile URL</label><input id="rate-profile" type="url" placeholder="Paste profile URL (optional)"/><p className="rate-help">Reference only; audience size is entered manually.</p></details>
      </div>
      <div className="rate-result" aria-live="polite" aria-atomic="true">
        <div className="rate-offer-top"><span className="rate-offer-badge"><ChannelIcon channel={channel}/>{config.label}</span><span>USD</span></div>
        <span className="rate-offer-label">Your starting offer</span>
        {estimate !== null ? <><div className="rate-price" key={`${channel}-${estimate}`}>{dollars(estimate)}</div><p className="rate-unit">for one {config.unit}</p><p className="rate-efficiency">{dollars(estimate / count * 1000)} per 1,000 {config.audience}</p></> : <><h2>{!audience || count <= 0 || !Number.isSafeInteger(count) ? "Enter an audience size" : "Let’s talk scope"}</h2><p>Ask for a custom quote outside {minimumAudience.toLocaleString("en-US")}–{maximumAudience.toLocaleString("en-US")} {config.audience}.</p></>}
        <div className="rate-included"><span><Check size={16}/> Original educational content</span><span><Check size={16}/> Creation + publication</span></div>
        <div className="rate-result-note">An estimated offer, not a confirmed creator rate.</div>
      </div>
    </div>
    <details className="rate-method"><summary>How this estimate is calculated</summary><p>These are our starting-offer benchmarks for substantive B2B content, not surveyed market rates. Between the listed audience sizes, we interpolate in a straight line. Total offers rise with audience size, while the cost per 1,000 falls. Displayed amounts are rounded to the nearest dollar. Audience size alone does not measure quality or audience fit. Agree scope and price with the creator; usage rights, exclusivity and extra revisions are separate.</p><table><caption>{config.label} benchmarks (USD per {config.unit})</caption><thead><tr><th>{config.audience}</th><th>Starting offer</th></tr></thead><tbody>{audienceAnchors.map((size, index) => <tr key={size}><td>{size.toLocaleString("en-US")}</td><td>{dollars(config.rates[index])}</td></tr>)}</tbody></table></details>
  </section>;
}
