import { Heart, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ReferralHeaderProps {
  participantName: string;
  organizationName: string;
  campaignName: string;
  isActive: boolean;
  isUpcoming: boolean;
  hasEnded: boolean;
}

export function ReferralHeader({
  participantName,
  organizationName,
  campaignName,
  isActive,
  isUpcoming,
  hasEnded,
}: ReferralHeaderProps) {
  return (
    <div className="text-center mb-6">
      {/* Status Badge */}
      {isUpcoming && (
        <Badge className="bg-blue-500 text-white hover:bg-blue-600 mb-4">
          Upcoming Fundraiser
        </Badge>
      )}
      {hasEnded && (
        <Badge className="bg-gray-500 text-white hover:bg-gray-600 mb-4">
          Fundraiser Ended
        </Badge>
      )}
      {isActive && (
        <Badge className="bg-green-500 text-white hover:bg-green-600 mb-4">
          Active Now!
        </Badge>
      )}

      {/* Participant Personalization */}
      <div className="inline-flex items-center justify-center gap-2 bg-white/10 backdrop-blur rounded-full px-6 py-3 mb-4">
        <User className="w-5 h-5 text-yellow-300" />
        <span className="text-lg font-semibold">
          You&apos;re supporting {participantName}
        </span>
        <Heart className="w-5 h-5 text-red-400 fill-current" />
      </div>

      {/* Campaign Title */}
      <h1 className="text-4xl lg:text-5xl font-serif font-bold mb-4 text-shadow-lg">
        {campaignName}
      </h1>

      {/* Organization */}
      <p className="text-2xl lg:text-3xl text-verde-100 mb-6">
        Supporting {organizationName}
      </p>

      {/* Personalized Message */}
      <div className="max-w-2xl mx-auto bg-white/5 backdrop-blur border border-white/20 rounded-lg p-4">
        <p className="text-lg text-white/90">
          Every purchase you make through this link directly supports{' '}
          <span className="font-bold text-yellow-300">{participantName}</span> and
          helps {organizationName} reach their fundraising goal!
        </p>
      </div>
    </div>
  );
}
