import Link from "next/link";

/** A person in a search lens, paired with the full product name. */
export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return <Link className={`marketing-brand brand-lockup${inverse ? " brand-lockup-inverse" : ""}`} href="/" aria-label="B2B Influencer Finder home">
    <svg className="brand-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="3.5"/>
      <path d="m32 32 10 10" stroke="currentColor" strokeWidth="5" strokeLinecap="round"/>
      <circle cx="20" cy="15" r="4" fill="currentColor"/>
      <path d="M12.5 28v-1a7.5 7.5 0 0 1 15 0v1Z" fill="currentColor"/>
    </svg>
    <span className="brand-wordmark"><strong>B2B Influencer<span className="brand-finder">Finder</span></strong></span>
  </Link>;
}
