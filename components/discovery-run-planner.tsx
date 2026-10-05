"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { channelNames, type Channel } from "@/lib/channels/core";
import { audienceChannels, defaultFilters, evidenceLabels } from "@/lib/channels/filters";
import { createDiscoveryRun, type DiscoveryActionState } from "@/app/app/brands/discovery-actions";

type Props={brandSlug:string;industries:string[];channels:{channel:Channel;ready:boolean;requirement:string}[]};
export function DiscoveryRunPlanner({brandSlug,industries,channels}:Props){
 const [selected,setSelected]=useState<Channel[]>(channels.find(c=>c.channel==="linkedin")?.ready?["linkedin"]:[]);
 const [state,action,pending]=useActionState(createDiscoveryRun,{} as DiscoveryActionState);
 const preparationDialog = useRef<HTMLDialogElement>(null);
 useEffect(() => {
  if (!pending) return;
  const dialog = preparationDialog.current;
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  dialog?.showModal();
  return () => { dialog?.close(); previousFocus?.focus(); };
 }, [pending]);
 return <form action={action} className="channel-run-form">
  <input type="hidden" name="brandSlug" value={brandSlug}/>
  <fieldset className="channel-picker"><legend>Where to search</legend>{channels.map(c=><label key={c.channel}><input type="checkbox" name="channel" value={c.channel} checked={selected.includes(c.channel)} onChange={e=>setSelected(s=>e.target.checked?[...s,c.channel]:s.filter(v=>v!==c.channel))} disabled={!c.ready}/><strong>{channelNames[c.channel]}</strong><small>{c.ready?"Connected":`Needs ${c.requirement}`}</small></label>)}</fieldset>
  <details className="search-options"><summary>Refine your search <span>Industries, focus and search size</span></summary><div className="run-shared-settings">
   <fieldset className="run-choices"><legend>Target industries for this run</legend>{industries.map(i=><label key={i}><input type="checkbox" name="industry" value={i} defaultChecked/>{i}</label>)}</fieldset>
   <label>Focus this search <small>Optional</small><input className="text-input" name="focus" maxLength={500} placeholder="e.g. Find people discussing student acquisition"/><small>Leave blank to let AI use your brand, industries and active content.</small></label>
   <label>Candidates to review per selected channel<input className="text-input" type="number" name="maxProfiles" min="1" max="100" defaultValue="30" required/><small>A collection limit, not a guaranteed number of matches.</small></label>
  </div>
  </details>
  <details className="search-options"><summary>Channel filters <span>Audience size and recent content</span></summary>
  {channels.map(({channel:c})=>{const d=defaultFilters(c);const audience=audienceChannels.includes(c);const metric=c==="youtube"?"subscribers":"followers";return <fieldset className="run-channel-settings" key={c} hidden={!selected.includes(c)} disabled={!selected.includes(c)}><legend>{channelNames[c]} settings</legend><div className="run-settings-grid">
   {audience?<><label>Minimum {metric}<input aria-label={`${channelNames[c]} minimum ${metric}`} className="text-input" type="number" name={`${c}.minAudience`} min="0" max="1000000000" defaultValue={d.minAudience??""} placeholder="No minimum"/></label><label>Maximum {metric}<input aria-label={`${channelNames[c]} maximum ${metric}`} className="text-input" type="number" name={`${c}.maxAudience`} min="0" max="1000000000" defaultValue={d.maxAudience??""} placeholder="No maximum"/></label></>:null}
   <label>{evidenceLabels[c]}<input aria-label={`${channelNames[c]} ${evidenceLabels[c].toLowerCase()}`} className="text-input" type="number" name={`${c}.evidenceLimit`} min={c==="linkedin"?1:3} max={c==="linkedin"?200:10} defaultValue={d.evidenceLimit} required/></label>
   <label>Content published within<select aria-label={`${channelNames[c]} content published within`} className="text-input" name={`${c}.publishedWithinDays`} defaultValue="180"><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="180">Last 180 days</option></select></label>
  </div>{audience?<label className="run-checkbox"><input type="checkbox" name={`${c}.includeUnknownAudience`} defaultChecked={d.includeUnknownAudience}/>Include creators with unknown audience size</label>:<p>Audience size is not filtered: reliable {c==="podcast"?"download":c==="newsletter"?"subscriber":"readership"} figures are unavailable.</p>}
  {c==="x"?<p>X searches recent posts from the last seven days; the publication window applies to the collected profile timeline.</p>:null}
  {c==="youtube"?<p>Subscriber limits apply to the channel. Evidence uses available video descriptions.</p>:null}
  {c==="linkedin"?<p>The collection limit applies across this run’s LinkedIn searches, not to each profile.</p>:<p>Up to 10 items per candidate are supported in this bounded discovery pass.</p>}
  </fieldset>})}
  </details>

  <details className="run-advanced"><summary>Advanced settings</summary><label>Maximum search queries across all channels<input className="text-input" name="maxQueries" type="number" min={Math.max(1,selected.length)} max="25" defaultValue="20" required/></label><p>Queries are shared across selected channels and industries. Review the exact coverage before starting.</p></details>
  {state.error?<div className="auth-error" role="alert">{state.error}</div>:null}
  <p className="search-cost-note">First we prepare your search using your brand and content. You’ll review the settings before it runs. Preparation uses AI credits.</p><button className="primary-button" disabled={pending||!selected.length} type="submit"><Search size={15}/>{pending?"Preparing your search…":"Start searching"}</button>
  <dialog ref={preparationDialog} className="search-preparation-dialog" aria-labelledby="search-preparation-title" aria-describedby="search-preparation-description" onCancel={event=>event.preventDefault()}>
   <div className="search-preparation-icon"><LoaderCircle className="spin" size={30} aria-hidden="true"/></div>
   <h2 id="search-preparation-title">Preparing your search</h2>
   <p id="search-preparation-description">We’re preparing our agents to find influencers who fit your target industries.</p>
   <div className="search-preparation-next"><span>UP NEXT</span><strong>Review your search settings</strong><p>You’ll check the plan before the search begins.</p></div>
   <p className="search-preparation-wait" role="status">This can take a minute. Keep this page open.</p>
  </dialog>
 </form>;
}
