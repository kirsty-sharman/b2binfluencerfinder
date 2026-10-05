import Image from 'next/image';
import { Globe, FileText, Play, Link2, Check } from 'lucide-react';

/** Illustrative editorial cards, not interactive product controls. */
export function MarketingProcessVisual({kind,wide=false}:{kind:'brand'|'content'|'match';wide?:boolean}) {
 return <div className={`process-visual process-visual-${kind}${wide?' process-visual-wide':''}`} role="img" aria-label={kind==='brand'?'Illustration of your website and target industries':kind==='content'?'Illustration of blog articles and videos published by your brand':'Illustration connecting a relevant creator with your content'}>
 {kind==='brand'?<div className="process-browser"><div className="process-browser-bar"><i/><i/><i/><span>yourbrand.com</span></div><div className="process-browser-body"><Globe size={24}/><strong>Your expertise.<br/>Your corner of the market.</strong><div className="process-lines"><i/><i/></div><div className="process-tags"><span>Your industry</span><span>Your buyers</span></div></div></div>:null}
 {kind==='content'?<div className="process-content-stack"><div className="process-article"><span><FileText size={14}/> BLOG</span><strong>Ideas worth<br/>talking about.</strong><div className="process-lines"><i/><i/><i/></div></div><div className="process-video"><Play size={25} fill="currentColor"/><span>YOUR VIDEOS</span></div></div>:null}
 {kind==='match'?<div className="process-match-pair"><div className="process-expert"><Image src="/photos/creator.webp" width={100} height={100} alt=""/><span>Relevant expert</span></div><span className="process-link"><Link2 size={22}/></span><div className="process-match-asset"><FileText size={26}/><span>Your content</span></div><div className="process-match-caption"><Check size={14}/> A shared topic. A reason to collaborate.</div></div>:null}
 </div>;
}
