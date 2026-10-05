import Link from "next/link";

/** Two interlocking people: the brand and the specialist it matches with. */
export function BrandLogo() {
  return <Link className="marketing-brand brand-lockup" href="/" aria-label="B2B Influencer Finder home">
    <svg className="brand-symbol" viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <circle cx="20" cy="13" r="7" fill="#20392c"/>
      <path d="M20 28h14a12 12 0 0 1 0 24H20a12 12 0 0 1 0-24Z" stroke="#20392c" strokeWidth="10"/>
      <circle cx="44" cy="51" r="7" fill="#e91d55"/>
      <path d="M30 12h14a12 12 0 0 1 0 24H30a12 12 0 0 1 0-24Z" stroke="#e91d55" strokeWidth="10"/>
      <path d="M20 28h14" stroke="#20392c" strokeWidth="10" strokeLinecap="round"/>
    </svg>
    <span className="brand-wordmark"><span className="brand-prefix">B2B</span><strong>Influencer<span className="brand-finder">Finder<span className="brand-period">.</span></span></strong></span>
  </Link>;
}
