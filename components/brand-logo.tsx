import Link from "next/link";

/** A slim person framed by an open flame, paired with the full product name. */
export function BrandLogo({ inverse = false }: { inverse?: boolean }) {
  return <Link className={`marketing-brand brand-lockup${inverse ? " brand-lockup-inverse" : ""}`} href="/" aria-label="B2B Influencer Finder home">
    <svg className="brand-symbol" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M22 2C24 15 7 17 6 30c-.7 7 3.5 12 9 15a12 12 0 1 1 18 0c6-3 10-9 9-17C41 17 31 7 22 2Z" fill="currentColor"/>
      <circle cx="24" cy="33" r="3.5" fill="currentColor"/>
      <path d="M18.5 44v-2a5.5 5.5 0 0 1 11 0v2c-3.4 1.5-7.6 1.5-11 0Z" fill="currentColor"/>
    </svg>
    <span className="brand-wordmark"><strong>B2B Influencer<span className="brand-finder">Finder</span></strong></span>
  </Link>;
}
