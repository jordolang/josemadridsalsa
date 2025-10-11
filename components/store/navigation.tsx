"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Search, ShoppingCart, Menu, X, User, Heart, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuLink, NavigationMenuContent, NavigationMenuTrigger } from "@/components/ui/navigation-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useCartStore } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

const salsaCategories = [
  { name: "Mild & Sweet", href: "/products?heat=mild", description: "Perfect for beginners and families" },
  { name: "Medium Heat", href: "/products?heat=medium", description: "Just the right kick" },
  { name: "Hot & Spicy", href: "/products?heat=hot", description: "For the brave souls" },
  { name: "Gourmet Fruit", href: "/products?heat=fruit", description: "Unique fruit-infused flavors" },
  { name: "Bundle Deals", href: "/products", description: "Mix & match your favorites" },
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
    title: "About Jose",
    href: "/about",
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
    title: "Where is Jose?",
    href: "/where-is-jose",
  },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const { items, toggleCart } = useCartStore();
  
  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

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
        "sticky top-0 z-50 w-full border-b transition-all duration-300",
        isScrolled
          ? "bg-white/95 backdrop-blur-md shadow-lg border-gray-200"
          : "bg-white border-gray-100"
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between lg:h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center space-x-2 font-serif font-bold text-xl lg:text-2xl"
          >
            <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-gradient-to-br from-salsa-500 to-chile-500 flex items-center justify-center text-white font-bold text-sm lg:text-base">
              JM
            </div>
            <span className="text-gradient">Jose Madrid Salsa</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center lg:space-x-6">
            <NavigationMenu>
              <NavigationMenuList className="space-x-1">
                {navigationItems.map((item) => (
                  <NavigationMenuItem key={item.title}>
                    {item.megaMenu ? (
                      <>
                        <NavigationMenuTrigger className="h-auto p-2 text-sm font-medium hover:text-salsa-600 data-[state=open]:text-salsa-600">
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
                          className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors hover:text-salsa-600 focus:text-salsa-600 focus:outline-none disabled:pointer-events-none disabled:opacity-50"
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

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-6">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 h-9 rounded-l-lg rounded-r-none border-r-0 focus:ring-salsa-500 focus:border-salsa-500"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                className="rounded-l-none rounded-r-lg h-9 px-4 bg-salsa-500 hover:bg-salsa-600"
              >
                Search
              </Button>
            </form>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2 lg:space-x-4">
            {/* Search Icon (Mobile) */}
            <Button variant="ghost" size="sm" className="md:hidden p-2">
              <Search className="w-5 h-5" />
            </Button>

            {/* Account */}
            {session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="hidden lg:flex p-2 relative">
                    <User className="w-5 h-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{session.user?.name}</p>
                      <p className="text-xs text-muted-foreground">{session.user?.email}</p>
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
              <div className="hidden lg:flex space-x-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/auth/signin">
                    Sign In
                  </Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/auth/signup">
                    Sign Up
                  </Link>
                </Button>
              </div>
            )}

            {/* Wishlist */}
            <Button variant="ghost" size="sm" className="hidden lg:flex p-2 relative">
              <Heart className="w-5 h-5" />
            </Button>

            {/* Cart */}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCart}
              className="relative p-2"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartItemCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs bg-salsa-500"
                >
                  {cartItemCount}
                </Badge>
              )}
            </Button>

            {/* Mobile Menu */}
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="lg:hidden p-2">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80">
                <SheetHeader>
                  <SheetTitle className="text-left font-serif text-gradient">
                    Jose Madrid Salsa
                  </SheetTitle>
                </SheetHeader>
                
                <div className="mt-6 space-y-6">
                  {/* Mobile Search */}
                  <form onSubmit={handleSearch} className="space-y-2">
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
                  <nav className="space-y-4">
                    {navigationItems.map((item) => (
                      <div key={item.title}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="block py-2 px-1 text-lg font-medium hover:text-salsa-600 transition-colors"
                        >
                          {item.title}
                        </Link>
                        {item.megaMenu && (
                          <div className="ml-4 mt-2 space-y-2">
                            {item.megaMenu.map((category) => (
                              <Link
                                key={category.name}
                                href={category.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block py-1 text-sm text-gray-600 hover:text-salsa-600 transition-colors"
                              >
                                {category.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </nav>

                  {/* Mobile Account Actions */}
                  <div className="pt-4 border-t space-y-2">
                    {session ? (
                      <div className="space-y-2">
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <p className="text-sm font-medium">{session.user?.name}</p>
                          <p className="text-xs text-muted-foreground">{session.user?.email}</p>
                        </div>
                        <Button variant="outline" className="w-full justify-start" asChild>
                          <Link href="/account" onClick={() => setIsMobileMenuOpen(false)}>
                            <User className="w-4 h-4 mr-2" />
                            My Account
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start" asChild>
                          <Link href="/account/orders" onClick={() => setIsMobileMenuOpen(false)}>
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Order History
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Heart className="w-4 h-4 mr-2" />
                          Wishlist
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
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
                      <div className="space-y-2">
                        <Button className="w-full" asChild>
                          <Link href="/auth/signup" onClick={() => setIsMobileMenuOpen(false)}>
                            Sign Up
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full" asChild>
                          <Link href="/auth/signin" onClick={() => setIsMobileMenuOpen(false)}>
                            Sign In
                          </Link>
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Heart className="w-4 h-4 mr-2" />
                          Wishlist
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