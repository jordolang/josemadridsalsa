"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Instagram, 
  Twitter, 
  Heart,
  Star,
  ArrowRight,
  CheckCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const footerLinks = {
  shop: [
    { label: "All Salsas", href: "/salsas" },
    { label: "Mild & Sweet", href: "/salsas?category=mild" },
    { label: "Medium Heat", href: "/salsas?category=medium" },
    { label: "Hot & Spicy", href: "/salsas?category=hot" },
    { label: "Gourmet Fruit", href: "/salsas?category=gourmet" },
    { label: "Bundle Deals", href: "/bundles" },
  ],
  company: [
    { label: "About Jose", href: "/about" },
    { label: "Our Story", href: "/story" },
    { label: "Find Us in Stores", href: "/find-us" },
    { label: "Where is Jose?", href: "/where-is-jose" },
    { label: "Recipes", href: "/recipes" },
    { label: "Reviews", href: "/testimonials" },
  ],
  business: [
    { label: "Fundraising", href: "/fundraising" },
    { label: "Wholesale", href: "/wholesale" },
    { label: "Success Stories", href: "/success-stories" },
    { label: "Become a Partner", href: "/partner" },
    { label: "Bulk Orders", href: "/bulk-orders" },
  ],
  support: [
    { label: "Contact Us", href: "/contact" },
    { label: "FAQ", href: "/faq" },
    { label: "Shipping Info", href: "/shipping" },
    { label: "Returns", href: "/returns" },
    { label: "Track Order", href: "/track" },
    { label: "Size Guide", href: "/size-guide" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
    { label: "Accessibility", href: "/accessibility" },
  ],
};

const socialLinks = [
  {
    name: "Facebook",
    href: "https://facebook.com/josemadridsalsa",
    icon: Facebook,
    hoverColor: "hover:text-blue-500",
  },
  {
    name: "Instagram", 
    href: "https://instagram.com/josemadridsalsa",
    icon: Instagram,
    hoverColor: "hover:text-pink-500",
  },
  {
    name: "Twitter",
    href: "https://twitter.com/josemadridsalsa", 
    icon: Twitter,
    hoverColor: "hover:text-blue-400",
  },
];

const achievements = [
  { label: "Award-Winning", icon: Star },
  { label: "All Natural", icon: Heart },
  { label: "Handcrafted", icon: CheckCircle },
];

export function Footer() {
  const [email, setEmail] = useState("");
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSubscribing(true);
    
    try {
      // In a real app, this would call your newsletter API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSubscribed(true);
      setEmail("");
      toast({
        title: "Welcome to our newsletter!",
        description: "You'll receive exclusive updates about new flavors and special offers.",
      });
    } catch (error) {
      toast({
        title: "Subscription failed",
        description: "Please try again later or contact support.",
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <footer className="bg-gray-900 text-white">
      {/* Newsletter Section */}
      <div className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-12">
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="text-2xl md:text-3xl font-serif font-bold mb-4">
              Stay in the Loop!
            </h3>
            <p className="text-gray-300 text-lg mb-8 max-w-2xl mx-auto">
              Get exclusive updates about new salsa flavors, special offers, and Jose's upcoming appearances. Plus, receive a 10% discount on your first order!
            </p>
            
            {!isSubscribed ? (
              <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isSubscribing}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400 focus:bg-white/20 focus:border-salsa-500"
                />
                <Button
                  type="submit"
                  disabled={isSubscribing || !email}
                  className="bg-salsa-500 hover:bg-salsa-600 text-white font-semibold px-6"
                >
                  {isSubscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            ) : (
              <div className="flex items-center justify-center gap-2 text-verde-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Thanks for subscribing!</span>
              </div>
            )}
            
            <p className="text-xs text-gray-400 mt-4">
              We respect your privacy. Unsubscribe at any time.
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center space-x-2 mb-6">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-salsa-500 to-chile-500 flex items-center justify-center text-white font-bold">
                JM
              </div>
              <span className="text-xl font-serif font-bold text-gradient bg-gradient-to-r from-salsa-400 to-chile-400 bg-clip-text text-transparent">
                Jose Madrid Salsa
              </span>
            </Link>
            
            <p className="text-gray-300 mb-6 max-w-sm">
              Authentic, handcrafted salsas made with love and the finest ingredients. Supporting communities through fundraising since 2009.
            </p>

            {/* Achievements */}
            <div className="flex flex-wrap gap-2 mb-6">
              {achievements.map((achievement, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className="border-gray-600 text-gray-300 hover:border-salsa-400 hover:text-salsa-400 transition-colors"
                >
                  <achievement.icon className="w-3 h-3 mr-1" />
                  {achievement.label}
                </Badge>
              ))}
            </div>

            {/* Contact Info */}
            <div className="space-y-2 text-sm text-gray-300">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-salsa-400" />
                <a href="tel:+1-555-SALSA-JM" className="hover:text-white transition-colors">
                  (555) SALSA-JM
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-salsa-400" />
                <a href="mailto:hello@josemadridsalsa.com" className="hover:text-white transition-colors">
                  hello@josemadridsalsa.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-salsa-400" />
                <span>Ohio, USA</span>
              </div>
            </div>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Shop</h4>
            <ul className="space-y-2">
              {footerLinks.shop.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Business Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Business</h4>
            <ul className="space-y-2">
              {footerLinks.business.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-semibold text-white mb-4">Support</h4>
            <ul className="space-y-2">
              {footerLinks.support.map((link) => (
                <li key={link.href}>
                  <Link 
                    href={link.href}
                    className="text-gray-300 hover:text-white transition-colors text-sm"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="border-t border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Copyright */}
            <div className="text-gray-400 text-sm">
              © {new Date().getFullYear()} Jose Madrid Salsa. All rights reserved.
            </div>

            {/* Social Links */}
            <div className="flex items-center space-x-6">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "text-gray-400 transition-colors", 
                    social.hoverColor
                  )}
                  aria-label={`Follow us on ${social.name}`}
                >
                  <social.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            {/* Legal Links */}
            <div className="flex items-center space-x-4 text-sm">
              {footerLinks.legal.map((link, index) => (
                <div key={link.href} className="flex items-center">
                  <Link 
                    href={link.href}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                  {index < footerLinks.legal.length - 1 && (
                    <Separator orientation="vertical" className="h-4 mx-2 bg-gray-600" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}