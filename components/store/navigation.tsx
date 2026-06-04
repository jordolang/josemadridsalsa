"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  Search,
  ShoppingCart,
  Menu,
  User,
  Gift,
  LogOut,
  Settings,
  Facebook,
  Twitter,
  Store,
  Heart,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useWishlistStore } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { CartIcon } from "@/components/store/cart-icon";

interface NavSubItem {
  name: string;
  href: string;
  description: string;
}

interface NavGroup {
  id: "shop" | "about" | "for-you";
  title: string;
  featured?: { href: string; label: string; hint: string };
  items: NavSubItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "shop",
    title: "Shop",
    featured: {
      href: "/products",
      label: "All Products",
      hint: "Browse our complete collection of handcrafted salsas",
    },
    items: [
      { name: "Mild & Sweet", href: "/products?heat=mild", description: "Perfect for beginners and families" },
      { name: "Medium Heat", href: "/products?heat=medium", description: "Just the right kick" },
      { name: "Hot & Spicy", href: "/products?heat=hot", description: "For the brave souls" },
      { name: "Gourmet Fruit", href: "/products?heat=fruit", description: "Unique fruit-infused flavors" },
      { name: "Bundle Deals", href: "/bundles", description: "Mix & match your favorites" },
      { name: "Merchandise", href: "/merchandise", description: "T-shirts, hats, and accessories" },
    ],
  },
  {
    id: "about",
    title: "About",
    items: [
      { name: "Our Story", href: "/our-story", description: "From Clovis, NM to Zanesville, OH" },
      { name: "La Perla Ave", href: "/la-perla-ave", description: "Our tortilla chip maker in Toledo, OH" },
      { name: "The Heat Index", href: "/heat-index", description: "Stories, recipes, road notes, and salsa lore" },
      { name: "Recipes", href: "/recipes", description: "Cooking with our salsas" },
      { name: "Find Us", href: "/find-us", description: "Retailers near you" },
    ],
  },
  {
    id: "for-you",
    title: "For You",
    items: [
      { name: "Fundraising", href: "/fundraising", description: "Earn 50% profit" },
      { name: "Wholesale", href: "/wholesale", description: "Stock our jars" },
      { name: "Where Is Jose?", href: "/where-is-jose", description: "Catch us at events and markets" },
    ],
  },
];

const GOOGLE_BUSINESS_URL =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  "https://g.page/jose-madrid-salsa/review";

const SOCIAL_LINKS = [
  { name: "Facebook", href: "https://www.facebook.com/josemadridsalsa", icon: Facebook },
  { name: "X (Twitter)", href: "https://twitter.com/josemadridsalsa", icon: Twitter },
  { name: "Google Business", href: GOOGLE_BUSINESS_URL, icon: Store },
];

function isGroupActive(group: NavGroup, pathname: string): boolean {
  if (group.featured && pathname.startsWith(group.featured.href)) return true;
  return group.items.some((item) => {
    const base = item.href.split("?")[0];
    return base !== "/" && pathname.startsWith(base);
  });
}

/**
 * Skeleton shown while Suspense waits for useSearchParams() to resolve during
 * static prerender. Matches the masthead height so there's no layout shift.
 */
function NavigationFallback() {
  return (
    <header
      aria-hidden
      className="sticky top-0 z-50 h-[72px] w-full border-b border-border/60 bg-background/90 backdrop-blur-sm"
    />
  );
}

export function Navigation() {
  return (
    <Suspense fallback={<NavigationFallback />}>
      <NavigationContent />
    </Suspense>
  );
}

function NavigationContent() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openGroupId, setOpenGroupId] = useState<NavGroup["id"] | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const triggerRefs = useRef<Record<NavGroup["id"], HTMLButtonElement | null>>({
    shop: null,
    about: null,
    "for-you": null,
  });
  const panelRefs = useRef<Record<NavGroup["id"], HTMLDivElement | null>>({
    shop: null,
    about: null,
    "for-you": null,
  });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const user = session?.user;
  const wishlistCount = useWishlistStore((state) => state.items.length);
  const isHome = pathname === "/";

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  // Close dropdowns AND the mobile sheet on route change.
  useEffect(() => {
    setOpenGroupId(null);
    setIsMobileMenuOpen(false);
  }, [pathname, searchParams]);

  // Prevent a pending close timer from firing after unmount.
  useEffect(() => {
    return () => {
      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }
    };
  }, []);

  // When a panel closes, move focus to its trigger if a descendant had focus.
  // This prevents aria-hidden being applied to an ancestor of the focused element.
  useEffect(() => {
    if (openGroupId !== null) return;
    const active = document.activeElement as HTMLElement | null;
    if (!active) return;
    for (const id of Object.keys(panelRefs.current) as NavGroup["id"][]) {
      const panel = panelRefs.current[id];
      if (panel?.contains(active)) {
        triggerRefs.current[id]?.focus();
        break;
      }
    }
  }, [openGroupId]);

  const openGroup = (id: NavGroup["id"]) => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpenGroupId(id);
  };

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenGroupId(null), 140);
  };

  const focusPanelItem = (groupId: NavGroup["id"], direction: "first" | "last") => {
    // Defer until after the panel is rendered/visible.
    requestAnimationFrame(() => {
      const panel = panelRefs.current[groupId];
      if (!panel) return;
      const items = panel.querySelectorAll<HTMLElement>("[role='menuitem']");
      if (items.length === 0) return;
      const target = direction === "first" ? items[0] : items[items.length - 1];
      target.focus();
    });
  };

  const closeAndRefocusTrigger = (groupId: NavGroup["id"]) => {
    setOpenGroupId(null);
    triggerRefs.current[groupId]?.focus();
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    groupId: NavGroup["id"],
  ) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      openGroup(groupId);
      focusPanelItem(groupId, "first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      openGroup(groupId);
      focusPanelItem(groupId, "last");
    } else if (event.key === "Escape" && openGroupId === groupId) {
      event.preventDefault();
      setOpenGroupId(null);
    }
  };

  const handlePanelKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
    groupId: NavGroup["id"],
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRefocusTrigger(groupId);
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const panel = panelRefs.current[groupId];
    if (!panel) return;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>("[role='menuitem']"),
    );
    if (items.length === 0) return;
    event.preventDefault();
    const active = document.activeElement as HTMLElement | null;
    const currentIndex = active ? items.indexOf(active) : -1;
    const offset = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + offset + items.length) % items.length;
    items[nextIndex].focus();
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setSearchOpen(false);
    }
  };

  return (
    <header
      onMouseLeave={scheduleClose}
      className={cn(
        "sticky top-0 z-50 w-full transition-[background-color,box-shadow,border-color] duration-300",
        isHome
          ? "border-b border-[#8a5616]/70 bg-[#050505] text-white shadow-[0_1px_0_rgba(218,154,48,0.18)]"
          : cn(
              "text-foreground",
              isScrolled
                ? "bg-background/95 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.05),0_12px_28px_rgba(15,23,42,0.06)] dark:shadow-[0_0_30px_rgba(229,62,62,0.25)]"
                : "bg-background/90 backdrop-blur-sm",
            ),
      )}
    >
      <div className={cn("mx-auto px-4 sm:px-6", isHome ? "max-w-none lg:px-12" : "max-w-[1400px]")}>
        <div
          className={cn(
            "grid grid-cols-[auto_1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]",
            isHome ? "h-[103px]" : "h-[72px]",
          )}
        >
          {/* Wordmark */}
          <Link
            href="/"
            className={cn("group flex items-center justify-self-start", isHome ? "gap-4" : "gap-3")}
            onClick={() => setOpenGroupId(null)}
          >
            <span className={cn("relative flex-shrink-0", isHome ? "h-[66px] w-[66px]" : "h-11 w-11")}>
              <Image
                src="/images/shared/logo-image.png"
                alt="Jose Madrid Salsa"
                fill
                sizes={isHome ? "66px" : "44px"}
                className="object-contain transition-transform duration-300 group-hover:-rotate-[4deg]"
              />
            </span>
            <span className="leading-[1.02] text-left hidden sm:flex sm:flex-col">
              <span
                className={cn(
                  "font-serif font-bold tracking-[-0.01em]",
                  isHome ? "text-[32px] text-white" : "text-[20px] text-foreground",
                )}
              >
                Jose Madrid
              </span>
              <span
                className={cn(
                  "mt-[2px] font-semibold uppercase text-[#d9a235]",
                  isHome ? "text-[13px] tracking-[0.33em]" : "text-[10px] tracking-[0.24em] text-salsa-600",
                )}
              >
                Salsa · Est. 1987
              </span>
            </span>
          </Link>

          {/* Center nav — editorial labels with underline-on-active */}
          <nav className="hidden lg:flex items-center gap-1 justify-self-center">
            {NAV_GROUPS.map((group) => {
              const isOpen = openGroupId === group.id;
              const isActive = isGroupActive(group, pathname || "");
              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => openGroup(group.id)}
                >
                  <button
                    ref={(node) => {
                      triggerRefs.current[group.id] = node;
                    }}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    aria-controls={`nav-panel-${group.id}`}
                    onClick={() => setOpenGroupId(isOpen ? null : group.id)}
                    onFocus={() => openGroup(group.id)}
                    onKeyDown={(e) => handleTriggerKeyDown(e, group.id)}
                    className={cn("group relative py-3", isHome ? "px-8" : "px-5")}
                  >
                    <span
                      className={cn(
                        "text-[12.5px] font-semibold uppercase tracking-[0.22em] transition-colors duration-200",
                        isHome
                          ? "text-white group-hover:text-[#d9a235]"
                          : isActive || isOpen
                          ? "text-salsa-600"
                          : "text-foreground group-hover:text-salsa-600",
                      )}
                    >
                      {group.title}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "pointer-events-none absolute bottom-1.5 left-1/2 h-[1.5px] -translate-x-1/2 bg-salsa-600 transition-all duration-300 ease-out",
                        isHome ? "bg-[#d9a235]" : "bg-salsa-600",
                        isActive || isOpen ? "w-[22px]" : "w-0",
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Right utilities — search, theme, account, cart, menu */}
          <div className="flex items-center justify-end gap-0.5 justify-self-end">
            {/* Inline collapsible search (desktop) */}
            <form
              onSubmit={handleSearch}
              aria-hidden={!searchOpen}
              inert={!searchOpen}
              className={cn(
                "hidden lg:flex items-center overflow-hidden transition-[width] duration-300",
                searchOpen ? "w-56 mr-1" : "w-0",
              )}
            >
              <Input
                ref={searchRef}
                type="search"
                placeholder="Search salsas, recipes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onBlur={() => !searchQuery && setSearchOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSearchOpen(false);
                  }
                }}
                className="h-9 w-full rounded-md border-border bg-muted/60 px-3 text-sm focus:border-salsa-500 focus:bg-background focus:ring-1 focus:ring-salsa-500"
              />
            </form>

            <Button
              type="button"
              variant="ghost"
              aria-label="Search"
              onClick={() => setSearchOpen((open) => !open)}
                className={cn(
                  "h-10 w-10 min-h-[40px] min-w-[40px] p-0 text-muted-foreground transition-colors hover:bg-muted hover:text-salsa-600",
                  isHome && "text-white hover:bg-white/10 hover:text-[#d9a235]",
                  searchOpen && "bg-muted text-salsa-600",
                )}
            >
              <Search className="h-[17px] w-[17px]" />
            </Button>

            <ThemeToggle
              className={cn(
                "h-10 w-10 min-h-[40px] min-w-[40px] p-0 text-muted-foreground hover:text-salsa-600",
                isHome && "text-white hover:bg-white/10 hover:text-[#d9a235]",
              )}
            />

            {/* Account */}
            {isSignedIn ? (
              <div className="relative hidden lg:flex items-center justify-center h-10 w-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    aria-label="Account menu"
                    className={cn(
                      "relative h-10 w-10 min-h-[40px] min-w-[40px] p-0",
                      "bg-transparent hover:bg-transparent text-amber-400 hover:text-amber-200",
                      isHome && "text-amber-300 hover:text-amber-100",
                    )}
                  >
                    <User
                      className="h-[17px] w-[17px]"
                      style={{ filter: "drop-shadow(0 0 5px rgba(251,191,36,0.9)) drop-shadow(0 0 12px rgba(251,191,36,0.55))" }}
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="mr-2 h-4 w-4" /> My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/orders">
                      <ShoppingCart className="mr-2 h-4 w-4" /> Order History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wishlist">
                      <Heart className="mr-2 h-4 w-4" /> Wishlist
                      {wishlistCount > 0 && (
                        <Badge className="ml-auto" variant="secondary">
                          {wishlistCount}
                        </Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings">
                      <Settings className="mr-2 h-4 w-4" /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="text-salsa-600 focus:text-salsa-700"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>
            ) : (
              <Button
                variant="ghost"
                asChild
                aria-label="Sign in"
                className={cn(
                  "h-10 w-10 min-h-[40px] min-w-[40px] p-0 text-muted-foreground hover:text-salsa-600",
                  isHome && "text-white hover:bg-white/10 hover:text-[#d9a235]",
                )}
              >
                <Link href="/auth/signin">
                  <User className="h-[17px] w-[17px]" />
                </Link>
              </Button>
            )}

            {/* Gift Certificates (desktop only) */}
            <Button
              variant="ghost"
              asChild
              className={cn(
                "hidden lg:flex h-10 w-10 min-h-[40px] min-w-[40px] p-0 text-muted-foreground hover:text-salsa-600",
                isHome && "text-white hover:bg-white/10 hover:text-[#d9a235]",
              )}
            >
              <Link href="/gift-certificates/purchase" aria-label="Purchase Gift Certificate">
                <Gift className="h-[17px] w-[17px]" />
              </Link>
            </Button>

            <span
              aria-hidden
              className={cn("mx-1 hidden h-5 w-px bg-border lg:block", isHome && "bg-white/25")}
            />

            {/* Cart */}
            <div className="flex-shrink-0">
              <CartIcon className={cn(isHome && "text-white hover:bg-white/10 hover:text-[#d9a235]")} />
            </div>

            {/* Mobile menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
                  className={cn("relative lg:hidden h-10 w-10 min-h-[40px] min-w-[40px] p-0 text-foreground", isHome && "text-white")}
                >
                  <Menu className="h-5 w-5" />
                  {isSignedIn && (
                    <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-background animate-pulse" />
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="flex w-80 flex-col">
                <SheetHeader className="flex-shrink-0">
                  <SheetTitle className="text-left font-serif text-gradient">
                    Jose Madrid Salsa
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 flex-1 space-y-4 overflow-y-auto pr-2">
                  <form onSubmit={handleSearch} className="space-y-2">
                    <Input
                      type="search"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full focus:border-salsa-500 focus:ring-salsa-500"
                    />
                    <Button type="submit" className="w-full bg-salsa-500 hover:bg-salsa-600">
                      Search
                    </Button>
                  </form>

                  <nav className="space-y-3">
                    {NAV_GROUPS.map((group) => (
                      <div key={group.id}>
                        <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-salsa-600">
                          {group.title}
                        </p>
                        <div className="space-y-0.5">
                          {group.featured && (
                            <Link
                              href={group.featured.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex min-h-[44px] items-center justify-between rounded-md bg-salsa-50 px-3 py-2 text-sm font-semibold text-salsa-700 hover:bg-salsa-100"
                            >
                              {group.featured.label}
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          )}
                          {group.items.map((item) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex min-h-[44px] items-center rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                            >
                              {item.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </nav>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">Appearance</p>
                      <p className="text-xs text-muted-foreground">Toggle theme</p>
                    </div>
                    <ThemeToggle className="h-11 w-11 min-h-[44px] min-w-[44px] p-0" />
                  </div>

                  <div className="border-t border-border pt-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Connect with us
                    </p>
                    <div className="flex items-center gap-2">
                      {SOCIAL_LINKS.map((social) => (
                        <Button
                          key={social.name}
                          variant="outline"
                          asChild
                          className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full p-0 text-muted-foreground"
                        >
                          <a
                            href={social.href}
                            aria-label={`Open our ${social.name} profile`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <social.icon className="h-5 w-5" />
                          </a>
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        asChild
                        className="h-11 w-11 min-h-[44px] min-w-[44px] rounded-full p-0 text-muted-foreground"
                      >
                        <a
                          href="https://salsadocs.vercel.app"
                          aria-label="Developer Documentation"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <BookOpen className="h-5 w-5" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-border pt-3">
                    {isSignedIn ? (
                      <>
                        <div className="rounded-lg bg-muted p-2">
                          <p className="text-sm font-medium text-foreground">{user?.name}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                        <Button variant="outline" className="w-full min-h-[44px] justify-start" asChild>
                          <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                            <User className="mr-2 h-4 w-4" /> My Account
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px] justify-start" asChild>
                          <Link href="/account/orders" onClick={() => setIsMobileMenuOpen(false)}>
                            <ShoppingCart className="mr-2 h-4 w-4" /> Order History
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px] justify-start" asChild>
                          <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)}>
                            <Heart className="mr-2 h-4 w-4" /> Wishlist
                            {wishlistCount > 0 && (
                              <Badge className="ml-2" variant="secondary">
                                {wishlistCount}
                              </Badge>
                            )}
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px] justify-start" asChild>
                          <Link href="/gift-certificates/purchase" onClick={() => setIsMobileMenuOpen(false)}>
                            <Gift className="mr-2 h-4 w-4" /> Gift Certificates
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full min-h-[44px] justify-start border-salsa-200 text-salsa-600 hover:bg-salsa-50"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            signOut({ callbackUrl: "/" });
                          }}
                        >
                          <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button className="w-full min-h-[44px] bg-salsa-500 hover:bg-salsa-600" asChild onClick={() => setIsMobileMenuOpen(false)}>
                          <Link href="/auth/signup">Sign Up</Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px]" asChild onClick={() => setIsMobileMenuOpen(false)}>
                          <Link href="/auth/signin">Sign In</Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px] justify-start" asChild>
                          <Link href="/gift-certificates/purchase" onClick={() => setIsMobileMenuOpen(false)}>
                            <Gift className="mr-2 h-4 w-4" /> Gift Certificates
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Hairline below the masthead row */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </div>

      {/* Dropdown panels — positioned absolutely so they overlay content */}
      {NAV_GROUPS.map((group) => {
        const isOpen = openGroupId === group.id;
        const isShop = group.id === "shop";
        return (
          <div
            key={group.id}
            ref={(node) => {
              panelRefs.current[group.id] = node;
            }}
            id={`nav-panel-${group.id}`}
            role="menu"
            aria-label={group.title}
            onMouseEnter={() => openGroup(group.id)}
            onMouseLeave={scheduleClose}
            onKeyDown={(e) => handlePanelKeyDown(e, group.id)}
            aria-hidden={!isOpen}
            inert={!isOpen}
            className={cn(
              "absolute left-0 right-0 top-full transition-all duration-200 ease-out",
              isOpen
                ? "pointer-events-auto translate-y-0 opacity-100"
                : "pointer-events-none -translate-y-1 opacity-0",
            )}
          >
            <div className={cn("mx-auto px-6 pb-3 pt-2", isShop ? "max-w-5xl" : "max-w-3xl")}>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_20px_50px_rgba(15,23,42,0.10),0_8px_18px_rgba(15,23,42,0.04)]">
                {isShop ? (
                  <ShopPanel
                    group={group}
                    pathname={pathname || ""}
                    searchParams={searchParams}
                  />
                ) : (
                  <SimplePanel group={group} pathname={pathname || ""} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </header>
  );
}

interface PanelProps {
  group: NavGroup;
  pathname: string;
}

interface ShopPanelProps extends PanelProps {
  searchParams: ReturnType<typeof useSearchParams>;
}

function isShopItemActive(
  itemHref: string,
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
): boolean {
  const [base, query] = itemHref.split("?");
  if (!pathname.startsWith(base)) return false;
  if (!query) return pathname === base;
  // Match every key=value pair against the current URL search params.
  const target = new URLSearchParams(query);
  for (const [key, value] of target.entries()) {
    if (searchParams?.get(key) !== value) return false;
  }
  return true;
}

function ShopPanel({ group, pathname, searchParams }: ShopPanelProps) {
  if (!group.featured) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
      <Link
        href={group.featured.href}
        role="menuitem"
        className={cn(
          "group flex min-h-[260px] flex-col justify-between border-b border-border p-6 transition-colors md:border-b-0 md:border-r",
          "bg-gradient-to-br from-salsa-50 to-chile-50 hover:from-salsa-100 hover:to-chile-100",
        )}
      >
        <div>
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-salsa-600">
            Featured
          </div>
          <div className="mb-2 font-serif text-[26px] font-bold leading-tight text-salsa-700">
            {group.featured.label}
          </div>
          <p className="text-[13px] leading-relaxed text-foreground/80">{group.featured.hint}</p>
        </div>
        <div className="mt-6 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-salsa-600 transition-all group-hover:gap-3">
          Shop the collection
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </Link>
      <div className="grid grid-cols-1 gap-0.5 p-2 sm:grid-cols-2">
        {group.items.map((item) => {
          const active = isShopItemActive(item.href, pathname, searchParams);
          return (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className={cn(
                "group rounded-lg px-4 py-3 transition-colors",
                active ? "bg-salsa-50" : "hover:bg-muted/70",
              )}
            >
              <div
                className={cn(
                  "text-[14.5px] font-semibold leading-tight transition-colors",
                  active ? "text-salsa-600" : "text-foreground group-hover:text-salsa-600",
                )}
              >
                {item.name}
              </div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">
                {item.description}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SimplePanel({ group, pathname }: PanelProps) {
  return (
    <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-3">
      {group.items.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={cn(
              "group rounded-lg px-5 py-4 transition-colors",
              active ? "bg-salsa-50" : "hover:bg-muted/70",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div
                className={cn(
                  "font-serif text-[18px] font-bold leading-tight transition-colors",
                  active ? "text-salsa-600" : "text-foreground group-hover:text-salsa-600",
                )}
              >
                {item.name}
              </div>
              <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-salsa-600 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
            <div className="mt-1 text-[12px] leading-snug text-muted-foreground">
              {item.description}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
