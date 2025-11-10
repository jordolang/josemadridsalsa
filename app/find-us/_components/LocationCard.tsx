import Image from 'next/image';
import { MapPin, Phone, ExternalLink, Navigation2 } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

interface LocationCardProps {
  businessName: string;
  address: string;
  city: string;
  state: string;
  zipCode?: string | null;
  phone?: string | null;
  website?: string | null;
  photoUrl?: string | null;
  distanceMiles?: number | null;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function LocationCard({
  businessName,
  address,
  city,
  state,
  zipCode,
  phone,
  website,
  photoUrl,
  distanceMiles,
  isSelected = false,
  onSelect,
}: LocationCardProps) {
  const fullAddress = `${address}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ''}`;
  const imageSrc = photoUrl || '/images/store-placeholder.png';
  const handleSelect = () => onSelect?.();

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect?.();
    }
  };

  return (
    <div
      className={cn(
        'card overflow-hidden group transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-salsa-200',
        isSelected ? 'ring-2 ring-salsa-500 shadow-lg' : 'ring-1 ring-transparent',
      )}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-pressed={onSelect ? isSelected : undefined}
      onClick={onSelect ? handleSelect : undefined}
      onKeyDown={onSelect ? handleKeyDown : undefined}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full bg-gray-100 dark:bg-gray-800">
        <Image
          src={imageSrc}
          alt={`${businessName} storefront`}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
        />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Business Name */}
        <h3 className="text-base font-semibold text-salsa-700 dark:text-salsa-300 mb-2 line-clamp-2 min-h-[2.5rem]">
          {businessName}
        </h3>

        {typeof distanceMiles === 'number' && (
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Navigation2 className="w-3.5 h-3.5 text-chile-600" />
            {distanceMiles.toFixed(1)} miles away
          </div>
        )}

        {/* Address */}
        <div className="flex items-start gap-1.5 mb-2 text-gray-600 dark:text-gray-300">
          <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-verde-600" />
          <p className="text-xs leading-relaxed line-clamp-2">{fullAddress}</p>
        </div>

        {/* Phone */}
        {phone && (
          <div className="flex items-center gap-1.5 mb-2 text-gray-600 dark:text-gray-300">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-verde-600" />
            <span className="text-xs">{phone}</span>
          </div>
        )}

        {/* Website */}
        {website && (
          <div className="flex items-center gap-1.5 mb-2 text-gray-600 dark:text-gray-300">
            <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 text-salsa-600" />
            <span className="text-xs truncate">{website.replace(/^https?:\/\//, '')}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-3 flex gap-2">
          {/* Call Button */}
          {phone && (
            <a
              href={`tel:${phone.replace(/[^0-9+]/g, '')}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-verde-600 to-verde-700 hover:from-verde-700 hover:to-verde-800 rounded-md transition-all duration-200"
            >
              <Phone className="w-3.5 h-3.5" />
              Call
            </a>
          )}
          
          {/* Website Button */}
          {website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-gradient-to-r from-salsa-600 to-chile-600 hover:from-salsa-700 hover:to-chile-700 rounded-md transition-all duration-200"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Website
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
