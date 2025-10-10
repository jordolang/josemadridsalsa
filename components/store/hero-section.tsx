"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Star, Flame } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  title?: string;
  subtitle?: string;
  description?: string;
  primaryButton?: {
    text: string;
    href: string;
  };
  secondaryButton?: {
    text: string;
    href: string;
  };
  backgroundImage?: string;
  backgroundVideo?: string;
  gradient?: "primary" | "secondary" | "none";
  size?: "default" | "large" | "compact";
  badges?: Array<{
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    icon?: React.ReactNode;
  }>;
  className?: string;
  showStats?: boolean;
}

const stats = [
  { label: "Varieties", value: "12+" },
  { label: "Happy Customers", value: "10K+" },
  { label: "Fundraisers Supported", value: "500+" },
  { label: "Years of Excellence", value: "15+" },
];

export function HeroSection({
  title = "Premium Handcrafted Salsas",
  subtitle = "Made with Love, Served with Pride",
  description = "Experience the authentic taste of Jose Madrid's artisanal salsas. From mild and sweet to fiery hot, we have the perfect salsa for every palate. Supporting communities through fundraising programs since 2009.",
  primaryButton = { text: "Shop Salsas", href: "/salsas" },
  secondaryButton = { text: "Learn More", href: "/about" },
  backgroundImage,
  backgroundVideo,
  gradient = "primary",
  size = "default",
  badges = [
    { text: "Award Winning", icon: <Star className="w-3 h-3" /> },
    { text: "All Natural", variant: "secondary" as const },
    { text: "Handcrafted", icon: <Flame className="w-3 h-3" /> },
  ],
  className,
  showStats = true,
}: HeroSectionProps) {
  const sizeClasses = {
    compact: "py-12 lg:py-16",
    default: "py-16 lg:py-24",
    large: "py-20 lg:py-32",
  };

  const gradientClasses = {
    primary: "hero-gradient",
    secondary: "bg-gradient-to-br from-verde-500 to-verde-700",
    none: "",
  };

  return (
    <section 
      className={cn(
        "relative overflow-hidden",
        sizeClasses[size],
        gradient !== "none" ? gradientClasses[gradient] : "bg-white",
        className
      )}
    >
      {/* Background Image */}
      {backgroundImage && (
        <div className="absolute inset-0 z-0">
          <Image
            src={backgroundImage}
            alt="Hero background"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Background Video */}
      {backgroundVideo && (
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          >
            <source src={backgroundVideo} type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badges */}
          {badges && badges.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {badges.map((badge, index) => (
                <Badge
                  key={index}
                  variant={badge.variant || "default"}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium bg-white/90 text-gray-800 hover:bg-white transition-colors"
                >
                  {badge.icon}
                  {badge.text}
                </Badge>
              ))}
            </div>
          )}

          {/* Subtitle */}
          <p className={cn(
            "text-sm font-medium tracking-wider uppercase mb-4",
            gradient !== "none" || backgroundImage || backgroundVideo
              ? "text-white/90"
              : "text-salsa-600"
          )}>
            {subtitle}
          </p>

          {/* Title */}
          <h1 className={cn(
            "text-4xl md:text-6xl lg:text-7xl font-serif font-bold mb-6 leading-tight",
            gradient !== "none" || backgroundImage || backgroundVideo
              ? "text-white"
              : "text-gray-900"
          )}>
            {title}
          </h1>

          {/* Description */}
          <p className={cn(
            "text-lg md:text-xl mb-8 max-w-2xl mx-auto leading-relaxed",
            gradient !== "none" || backgroundImage || backgroundVideo
              ? "text-white/90"
              : "text-gray-600"
          )}>
            {description}
          </p>

          {/* Call to Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button
              asChild
              size="lg"
              className={cn(
                "px-8 py-4 text-base font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5",
                gradient !== "none" || backgroundImage || backgroundVideo
                  ? "bg-white text-salsa-600 hover:bg-gray-50"
                  : "bg-salsa-500 text-white hover:bg-salsa-600"
              )}
            >
              <Link href={primaryButton.href} className="flex items-center gap-2">
                {primaryButton.text}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>

            {secondaryButton && (
              <Button
                asChild
                variant="outline"
                size="lg"
                className={cn(
                  "px-8 py-4 text-base font-semibold rounded-full border-2 transition-all duration-300",
                  gradient !== "none" || backgroundImage || backgroundVideo
                    ? "border-white text-white hover:bg-white hover:text-salsa-600"
                    : "border-salsa-500 text-salsa-600 hover:bg-salsa-500 hover:text-white"
                )}
              >
                <Link href={secondaryButton.href}>
                  {secondaryButton.text}
                </Link>
              </Button>
            )}
          </div>

          {/* Stats */}
          {showStats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className={cn(
                    "text-center animate-fade-in",
                    `animation-delay-${(index + 1) * 200}`
                  )}
                >
                  <div className={cn(
                    "text-2xl md:text-3xl font-bold mb-1",
                    gradient !== "none" || backgroundImage || backgroundVideo
                      ? "text-white"
                      : "text-salsa-600"
                  )}>
                    {stat.value}
                  </div>
                  <div className={cn(
                    "text-sm font-medium uppercase tracking-wider",
                    gradient !== "none" || backgroundImage || backgroundVideo
                      ? "text-white/80"
                      : "text-gray-500"
                  )}>
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-10 right-10 opacity-20">
        <div className="w-20 h-20 rounded-full bg-white/10 animate-bounce-gentle" />
      </div>
      <div className="absolute bottom-10 left-10 opacity-20">
        <div className="w-16 h-16 rounded-full bg-white/10 animate-bounce-gentle animation-delay-400" />
      </div>
      <div className="absolute top-1/3 left-1/4 opacity-20">
        <div className="w-12 h-12 rounded-full bg-white/10 animate-bounce-gentle animation-delay-600" />
      </div>
    </section>
  );
}