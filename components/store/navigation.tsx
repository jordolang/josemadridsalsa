"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { Search, ShoppingCart, Menu, X, User, Gift, LogOut, Settings, Facebook, Twitter, Store, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink, NavigationMenuContent, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useWishlistStore } from "@/lib/store/wishlist";
import { cn } from "@/lib/utils";
import { CartIcon } from "@/components/store/cart-icon";

const salsaCategories = [
  { name: "Mild & Sweet", href: "/products?heat=mild", description: "Perfect for beginners and families" },
  { name: "Medium Heat", href: "/products?heat=medium", description: "Just the right kick" },
  { name: "Hot & Spicy", href: "/products?heat=hot", description: "For the brave souls" },
  { name: "Gourmet Fruit", href: "/products?heat=fruit", description: "Unique fruit-infused flavors" },
  { name: "Bundle Deals", href: "/bundles", description: "Mix & match your favorites" },
  { name: "Merchandise", href: "/merchandise", description: "T-shirts, hats, and accessories" },
];

const navigationItems = [
  {
    title: "Products",
    href: "/products",
    megaMenu: salsaCategories,
  },
  {
    title: "Recipes",
    href: "/recipes",
  },
  {
    title: "Our Story",
    href: "/our-story",
  },
  {
    title: "Find Us",
    href: "/find-us",
  },
  {
    title: "Fundraising",
    href: "/fundraising",
  },
  {
    title: "Wholesale",
    href: "/wholesale",
  },
  {
    title: "Where Is Jose?",
    href: "/where-is-jose",
  },
];

const googleBusinessUrl =
  process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL ??
  "https://g.page/jose-madrid-salsa/review";

const socialLinks = [
  {
    name: "Facebook",
    href: "https://www.facebook.com/josemadridsalsa",
    icon: Facebook,
  },
  {
    name: "X (Twitter)",
    href: "https://twitter.com/josemadridsalsa",
    icon: Twitter,
  },
  {
    name: "Google Business",
    href: googleBusinessUrl,
    icon: Store,
  },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const isSignedIn = status === "authenticated";
  const user = session?.user;
  const { totalItems } = useWishlistStore();

  const wishlistCount = totalItems();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b border-transparent bg-background/70 backdrop-blur-sm transition-[background-color,box-shadow,border-color] duration-300 text-foreground",
        isScrolled &&
          "border-border bg-background/90 shadow-[0_12px_32px_rgba(15,23,42,0.08)] dark:shadow-[0_0_30px_rgba(229,62,62,0.35)]"
      )}
    >
      <div className="container mx-auto px-2 sm:px-4 max-w-[1400px]">
        <div className="flex h-16 items-center gap-1">
          {/* Logo — 25% */}
          <Link
            href="/"
            className="flex items-center space-x-2 font-serif font-bold text-base lg:text-xl flex-shrink-0 min-h-[44px] w-[25%]"
          >
            <div className="relative w-11 h-11 lg:w-12 lg:h-12 flex-shrink-0" suppressHydrationWarning>
              <Image
                src="/images/logo-image.png"
                alt="Jose Madrid Salsa Logo"
                fill
                className="object-contain"
                priority
                sizes="(max-width: 640px) 2.75rem, 3rem"
              />
            </div>
            <span className="hidden sm:inline text-gradient">Jose Madrid Salsa</span>
          </Link>

          {/* Desktop Navigation + Search — 50% centered */}
          <div className="hidden lg:flex lg:items-center lg:justify-center lg:gap-2 w-[50%]">
            {/* Search inline with nav */}
            <form onSubmit={handleSearch} className="flex">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground opacity-70" />
                <input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 h-8 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-salsa-500 w-[120px]"
                />
              </div>
            </form>
            <NavigationMenu>
              <NavigationMenuList className="gap-0">
                {navigationItems.map((item) => (
                  <NavigationMenuItem key={item.title}>
                    {item.megaMenu ? (
                      <>
                        <NavigationMenuTrigger className="h-auto min-h-[44px] px-1.5 py-1.5 text-[11px] font-medium hover:text-salsa-600 data-[state=open]:text-salsa-600">
                          {item.title}
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <div className="grid w-96 gap-3 p-6">
                            <div className="row-span-3">
                              <NavigationMenuLink asChild>
                                <Link
                                  href={item.href}
                                  className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-salsa-50 to-chile-50 p-6 no-underline outline-none focus:shadow-md"
                                >
                                  <div className="mb-2 mt-4 text-lg font-medium text-salsa-700">
                                    All Products
                                  </div>
                                  <p className="text-sm leading-tight text-muted-foreground">
                                    Browse our complete collection of handcrafted salsas
                                  </p>
                                </Link>
                              </NavigationMenuLink>
                            </div>
                            {item.megaMenu.map((category) => (
                              <NavigationMenuLink key={category.name} asChild>
                                <Link
                                  href={category.href}
                                  className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                                >
                                  <div className="text-sm font-medium leading-none">{category.name}</div>
                                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                                    {category.description}
                                  </p>
                                </Link>
                              </NavigationMenuLink>
                            ))}
                          </div>
                        </NavigationMenuContent>
                      </>
                    ) : (
                      <NavigationMenuLink asChild>
                        <Link
                          href={item.href}
                          className="group inline-flex h-auto min-h-[44px] w-max items-center justify-center rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors hover:text-salsa-600 focus:text-salsa-600 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
                        >
                          {item.title}
                        </Link>
                      </NavigationMenuLink>
                    )}
                  </NavigationMenuItem>
                ))}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Search Bar — part of the 50% center block, hidden on lg since it's inside nav block */}
          <div className="hidden md:flex lg:hidden flex-1 max-w-[160px] mx-1">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground opacity-70" />
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2 h-11 text-sm rounded-l-lg rounded-r-none border-r-0 focus:ring-salsa-500 focus:border-salsa-500"
                />
              </div>
              <Button
                type="submit"
                className="rounded-l-none rounded-r-lg h-11 px-3 text-xs bg-salsa-500 hover:bg-salsa-600"
              >
                Search
              </Button>
            </form>
          </div>

          {/* Actions — 25% right */}
          <div className="flex items-center justify-end gap-1 lg:gap-2 w-[25%] flex-shrink-0">
            {/* Social Links — desktop only */}
            <div className="hidden xl:flex items-center gap-0.5 flex-shrink-0">
              {socialLinks.map((social) => (
                <Button
                  key={social.name}
                  variant="ghost"
                  asChild
                  className="min-h-[44px] min-w-[44px] p-0 flex-shrink-0 text-muted-foreground hover:text-salsa-500 dark:hover:text-salsa-300"
                >
                  <a
                    href={social.href}
                    aria-label={`Visit our ${social.name} profile`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <social.icon className="w-5 h-5" />
                  </a>
                </Button>
              ))}
            </div>

            <ThemeToggle className="min-h-[44px] min-w-[44px] p-0 flex-shrink-0" />

            {/* Search Icon (Mobile) */}
            <Button variant="ghost" aria-label="Search" className="md:hidden min-h-[44px] min-w-[44px] p-0 flex-shrink-0">
              <Search className="h-5 w-5 text-muted-foreground" />
            </Button>

            {/* Account (Mobile) */}
            {!isSignedIn && (
              <Button variant="ghost" asChild className="lg:hidden min-h-[44px] min-w-[44px] p-0 flex-shrink-0">
                <Link href="/auth/signin" aria-label="Sign in to your account">
                  <User className="w-5 h-5" />
                </Link>
              </Button>
            )}

            {/* Account */}
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" aria-label="Account menu" className="hidden lg:flex min-h-[44px] min-w-[44px] p-0 relative flex-shrink-0">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account">
                      <User className="mr-2 h-4 w-4" />
                      My Account
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/orders">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      Order History
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/wishlist">
                      <Heart className="mr-2 h-4 w-4" />
                      Wishlist
                      {wishlistCount > 0 && (
                        <Badge className="ml-auto" variant="secondary">{wishlistCount}</Badge>
                      )}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="text-red-600 focus:text-red-600"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="hidden lg:flex gap-1 flex-shrink-0">
                <Button variant="ghost" asChild className="min-h-[44px] px-3 text-xs whitespace-nowrap flex-shrink-0">
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
                <Button asChild className="min-h-[44px] px-3 text-xs whitespace-nowrap flex-shrink-0">
                  <Link href="/auth/signup">Sign Up</Link>
                </Button>
              </div>
            )}

            {/* Gift Certificates */}
            <Button variant="ghost" asChild className="hidden lg:flex min-h-[44px] min-w-[44px] p-0 relative flex-shrink-0">
              <Link href="/gift-certificates/purchase" aria-label="Purchase Gift Certificate">
                <Gift className="w-5 h-5" />
              </Link>
            </Button>

            {/* Cart */}
            <div className="flex-shrink-0">
              <CartIcon />
            </div>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"} className="lg:hidden min-h-[44px] min-w-[44px] p-0 flex-shrink-0">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 flex flex-col">
                <SheetHeader className="flex-shrink-0">
                  <SheetTitle className="text-left font-serif text-gradient">
                    Jose Madrid Salsa
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-2">
                  {/* Mobile Search */}
                  <form onSubmit={handleSearch} className="space-y-2 flex-shrink-0">
                    <Input
                      type="search"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full focus:ring-salsa-500 focus:border-salsa-500"
                    />
                    <Button type="submit" className="w-full bg-salsa-500 hover:bg-salsa-600">
                      Search
                    </Button>
                  </form>

                  {/* Mobile Navigation */}
                  <nav className="space-y-2">
                    {navigationItems.map((item) => (
                      <div key={item.title}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-3 px-1 text-base font-medium hover:text-salsa-600 transition-colors min-h-[44px] flex items-center"
                        >
                          {item.title}
                        </Link>
                        {item.megaMenu && (
                          <div className="ml-4 mt-1 space-y-1">
                            {item.megaMenu.map((category) => (
                              <Link
                                key={category.name}
                                href={category.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block py-2.5 text-sm text-muted-foreground hover:text-salsa-600 transition-colors min-h-[44px] flex items-center"
                              >
                                {category.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </nav>

                  <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-1.5">
                    <div>
                      <p className="text-sm font-medium text-foreground">Appearance</p>
                      <p className="text-xs text-muted-foreground">Toggle theme</p>
                    </div>
                    <ThemeToggle className="min-h-[44px] min-w-[44px] p-0" />
                  </div>

                  {/* Mobile Social Links */}
                  <div className="pt-3 border-t border-border">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                      Connect with us
                    </p>
                    <div className="flex items-center gap-2">
                      {socialLinks.map((social) => (
                        <Button
                          key={social.name}
                          variant="outline"
                                    asChild
                          className="min-h-[44px] min-w-[44px] rounded-full p-0 text-muted-foreground"
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
                    </div>
                  </div>

                  {/* Mobile Account Actions */}
                  <div className="pt-3 border-t border-border space-y-1.5">
                    {isSignedIn ? (
                      <div className="space-y-1.5">
                        <div className="rounded-lg bg-muted p-2">
                          <p className="text-sm font-medium text-foreground">{user?.name}</p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                        <Button variant="outline" className="w-full justify-start min-h-[44px]" asChild>
                          <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                            <User className="w-4 h-4 mr-2" />
                            My Account
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start min-h-[44px]" asChild>
                          <Link href="/account/orders" onClick={() => setIsMobileMenuOpen(false)}>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Order History
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start min-h-[44px]" asChild>
                          <Link href="/wishlist" onClick={() => setIsMobileMenuOpen(false)}>
                            <Heart className="w-4 h-4 mr-2" />
                            Wishlist
                            {wishlistCount > 0 && (
                              <Badge className="ml-2" variant="secondary">{wishlistCount}</Badge>
                            )}
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start min-h-[44px]" asChild>
                          <Link href="/gift-certificates/purchase" onClick={() => setIsMobileMenuOpen(false)}>
                            <Gift className="w-4 h-4 mr-2" />
                            Gift Certificates
                          </Link>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start min-h-[44px] text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            signOut({ callbackUrl: '/' });
                          }}
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          Sign Out
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <Button className="w-full min-h-[44px]" asChild onClick={() => setIsMobileMenuOpen(false)}>
                          <Link href="/auth/signup">Sign Up</Link>
                        </Button>
                        <Button variant="outline" className="w-full min-h-[44px]" asChild onClick={() => setIsMobileMenuOpen(false)}>
                          <Link href="/auth/signin">Sign In</Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start min-h-[44px]" asChild>
                          <Link href="/gift-certificates/purchase" onClick={() => setIsMobileMenuOpen(false)}>
                            <Gift className="w-4 h-4 mr-2" />
                            Gift Certificates
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
