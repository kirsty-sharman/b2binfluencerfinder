"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import {
  BookOpenText,
  Check,
  ChevronDown,
  CircleUserRound,
  FileText,
  Gauge,
  Eye,
  Handshake,
  Menu,
  LogOut,
  Play,
  Plus,
  Search,
  Settings,
  Star,
  Users,
} from "lucide-react";
import { signOut } from "@/app/sign-in/sign-out";
import type { Viewer } from "@/lib/auth";
import type { BrandSummary } from "@/lib/brands";

type ShellProps = {
  children: React.ReactNode;
  viewer: Viewer;
  brands: BrandSummary[];
};

const navGroups = [
  {
    label: "Workspace",
    links: [
      { label: "Dashboard", segment: "", icon: Gauge },
      { label: "Brand profile", segment: "profile", icon: CircleUserRound },
      { label: "Content assets", segment: "content", icon: FileText },
    ],
  },
  {
    label: "Discovery",
    links: [
      { label: "Search runs", segment: "runs", icon: Play },
      { label: "Creators", segment: "creators", icon: Users },
      { label: "Shortlists", segment: "shortlists", icon: Star },
      { label: "Rate estimator", segment: "rate-estimator", icon: Gauge },
    ],
  },
  {
    label: "Outcomes",
    links: [
      { label: "Manual outreach", segment: "outreach", icon: Handshake },
      { label: "Published evidence", segment: "publications", icon: BookOpenText },
      { label: "AI visibility", segment: "visibility", icon: Eye },
    ],
  },
];

export function AppShell({ children, viewer, brands }: ShellProps) {
  const pathname = usePathname();
  const accountMenu = useRef<HTMLDivElement>(null);
  const [logoutState, logoutAction, loggingOut] = useActionState(signOut, null);
  const [open, setOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const match = pathname.match(/\/app\/brands\/([^/]+)/);
  const routeBrandSlug = match?.[1];
  const brandSlug = routeBrandSlug && routeBrandSlug !== "new"
    ? routeBrandSlug
    : brands[0]?.slug;
  const activeBrand = brands.find((brand) => brand.slug === brandSlug) || brands[0];
  const base = brandSlug ? `/app/brands/${brandSlug}` : "/app";
  const countBySegment: Record<string, number> = activeBrand ? {
    phrases: activeBrand.counts.phrases,
    content: activeBrand.counts.assets,
    runs: activeBrand.counts.runs,
    creators: activeBrand.counts.creators,
    shortlists: activeBrand.counts.shortlists,
    outreach: activeBrand.counts.outreach,
    publications: activeBrand.counts.publications,
    visibility: activeBrand.counts.visibility,
  } : {};
  const liveNavGroups = navGroups.map((group) => ({
    ...group,
    links: group.links.map((item) => ({ ...item, count: countBySegment[item.segment] })),
  }));
  const currentLabel = pathname === "/app/brands/new"
    ? "Add brand"
    : liveNavGroups
      .flatMap((group) => group.links)
      .find((item) => (item.segment ? pathname.startsWith(`${base}/${item.segment}`) : pathname === base))?.label || "Workspace";

  return (
    <div className="app-layout">
      <aside className={`sidebar${open ? " open" : ""}`} aria-label="Workspace navigation">
        <button className="brand-switcher" type="button" aria-expanded={brandsOpen} onClick={() => setBrandsOpen((value) => !value)}>
          <span className="brand-mark">{activeBrand ? activeBrand.name.slice(0, 2).toUpperCase() : "+"}</span>
          <span>{activeBrand?.name || "Choose brand"}</span>
          <ChevronDown className="chevron" size={15} aria-hidden="true" />
        </button>
        {brandsOpen ? (
          <div className="brand-menu">
            {brands.map((brand) => (
              <Link className="brand-menu-link" href={`/app/brands/${brand.slug}`} key={brand.id} onClick={() => setBrandsOpen(false)}>
                <span className="brand-menu-mark">{brand.name.slice(0, 2).toUpperCase()}</span>
                <span>{brand.name}</span>
                {brand.slug === brandSlug ? <Check size={14} aria-hidden="true" /> : null}
              </Link>
            ))}
            <Link className="brand-menu-link brand-menu-add" href="/app/brands/new" onClick={() => setBrandsOpen(false)}><Plus size={15} aria-hidden="true" /><span>Add brand</span></Link>
          </div>
        ) : null}
        {activeBrand ? liveNavGroups.map((group) => (
          <div key={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.links.map((item) => {
              const href = item.segment ? `${base}/${item.segment}` : base;
              const active = item.segment ? pathname.startsWith(href) : pathname === href;
              const Icon = item.icon;
              return (
                <Link className={`nav-link${active ? " active" : ""}`} href={href} key={item.label} onClick={() => setOpen(false)}>
                  <Icon className="nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.count !== undefined ? <span className="nav-count">{item.count}</span> : null}
                </Link>
              );
            })}
          </div>
        )) : null}
        <div className="sidebar-footer">
          <button className="user-summary account-trigger" type="button" popoverTarget="account-menu" aria-label={`Account menu for ${viewer.displayName}`}>
            <span className="user-avatar">{viewer.initials}</span><span>{viewer.displayName}</span><ChevronDown size={15} aria-hidden="true"/>
          </button>
          <div id="account-menu" ref={accountMenu} popover="auto" className="account-popover">
            <div className="account-menu-identity"><strong>{viewer.displayName}</strong><span>{viewer.email}</span></div>
            <Link className="account-menu-item" href="/app/settings" onClick={() => { accountMenu.current?.hidePopover(); setOpen(false); }}><Settings size={17} aria-hidden="true"/><span>Account settings</span></Link>
            <form action={logoutAction}><button className="account-menu-item" type="submit" disabled={loggingOut}><LogOut size={17} aria-hidden="true"/><span>{loggingOut ? "Logging out…" : "Log out"}</span></button>{logoutState?.error ? <p className="logout-error" role="alert">{logoutState.error}</p> : null}</form>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button className="mobile-menu" type="button" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen((value) => !value)}><Menu size={20} /></button>
          <span>Brands</span><span>›</span><strong>{currentLabel}</strong>
          <span className="topbar-spacer" />
          <span className="search-placeholder"><Search size={14} aria-hidden="true" /> Search</span>
          <span className="provider-status"><span className={`provider-dot${viewer.previewMode ? " preview" : ""}`} />{viewer.previewMode ? "Local preview" : "Connected"}</span>
        </header>
        {children}
      </div>
    </div>
  );
}
