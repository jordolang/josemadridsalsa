/**
 * Email Templates Index
 * Central export for all email templates with backward compatibility
 */

// Email template definition type
export interface EmailTemplateDefinition {
  key: string
  name: string
  subject: string
  category: 'TRANSACTIONAL' | 'MARKETING' | 'ADMINISTRATIVE'
  description: string
  variables: Record<string, string>
  html: string
  text: string
}

// Import all individual templates
import { welcomeEmailTemplate } from './welcome-email'
import { orderConfirmationTemplate } from './order-confirmation'
import { shippingNotificationTemplate } from './shipping-notification'
import { emailVerificationTemplate } from './email-verification'
import { accountCreatedTemplate } from './account-created'
import { passwordResetTemplate } from './password-reset'
import { orderDeliveredTemplate } from './order-delivered'
import { orderCancellationTemplate } from './order-cancellation'
import { refundProcessedTemplate } from './refund-processed'
import { paymentFailedTemplate } from './payment-failed'
import { subscriptionRenewalTemplate } from './subscription-renewal'
import { wholesaleWelcomeTemplate } from './wholesale-welcome'
import { wholesaleOrderConfirmationTemplate } from './wholesale-order-confirmation'
import { thankYouTemplate } from './thank-you'
import { reviewRequestTemplate } from './review-request'
import { customerSurveyTemplate } from './customer-survey'
import { abandonedCartTemplate } from './abandoned-cart'
import { flashSaleTemplate } from './flash-sale'
import { productLaunchTemplate } from './product-launch'
import { fundraiserKickoffTemplate } from './fundraiser-kickoff'
import { fundraiserUpdateTemplate } from './fundraiser-update'
import { fundraiserMonthlyOutreachTemplate } from './fundraiser-monthly-outreach'
import { monthlyNewsletterTemplate } from './monthly-newsletter'
import { eventInvitationTemplate } from './event-invitation'
import seasonalSummerTemplate from './seasonal-summer'
import seasonalFallTemplate from './seasonal-fall'
import seasonalHolidayTemplate from './seasonal-holiday'
import { backInStockTemplate } from './back-in-stock'
import { winBackTemplate } from './win-back'
import { birthdaySpecialTemplate } from './birthday-special'
import { referralProgramTemplate } from './referral-program'
import { giftCertificateDeliveryTemplate } from './gift-certificate-delivery'
import { orderReadyPickupTemplate } from './order-ready-pickup'
import { announcementNewsletterTemplate } from './announcement-newsletter'
import { announcementSingleTemplate } from './announcement-single'
import { orderConfirmationLightTemplate } from './order-confirmation-light'
import { orderConfirmationDarkTemplate } from './order-confirmation-dark'
import { fundraiserPlatformAnnouncementTemplate } from './fundraiser-platform-announcement'
import { websiteLaunchAnnouncementTemplate } from './website-launch-announcement'
import { everythingIsLiveTemplate } from './everything-is-live'
import { mobileAppLaunchTemplate } from './mobile-app-launch'
import { fundraiserReferralInviteTemplate } from './fundraiser-referral-invite'
import { heatIndexDigestTemplate } from './heat-index-digest'
import { wholesaleProspectOutreachTemplate } from './wholesale-prospect-outreach'

// Export all templates individually for named imports
export {
  welcomeEmailTemplate,
  orderConfirmationTemplate,
  shippingNotificationTemplate,
  emailVerificationTemplate,
  accountCreatedTemplate,
  passwordResetTemplate,
  orderDeliveredTemplate,
  orderCancellationTemplate,
  refundProcessedTemplate,
  paymentFailedTemplate,
  subscriptionRenewalTemplate,
  wholesaleWelcomeTemplate,
  wholesaleOrderConfirmationTemplate,
  thankYouTemplate,
  reviewRequestTemplate,
  customerSurveyTemplate,
  abandonedCartTemplate,
  flashSaleTemplate,
  productLaunchTemplate,
  fundraiserKickoffTemplate,
  fundraiserUpdateTemplate,
  fundraiserMonthlyOutreachTemplate,
  monthlyNewsletterTemplate,
  eventInvitationTemplate,
  seasonalSummerTemplate,
  seasonalFallTemplate,
  seasonalHolidayTemplate,
  backInStockTemplate,
  winBackTemplate,
  birthdaySpecialTemplate,
  referralProgramTemplate,
  giftCertificateDeliveryTemplate,
  orderReadyPickupTemplate,
  announcementNewsletterTemplate,
  announcementSingleTemplate,
  orderConfirmationLightTemplate,
  orderConfirmationDarkTemplate,
  fundraiserPlatformAnnouncementTemplate,
  websiteLaunchAnnouncementTemplate,
  everythingIsLiveTemplate,
  mobileAppLaunchTemplate,
  fundraiserReferralInviteTemplate,
  heatIndexDigestTemplate,
  wholesaleProspectOutreachTemplate,
}

// Export array for backward compatibility
export const emailTemplates = [
  welcomeEmailTemplate,
  orderConfirmationTemplate,
  shippingNotificationTemplate,
  emailVerificationTemplate,
  accountCreatedTemplate,
  passwordResetTemplate,
  orderDeliveredTemplate,
  orderCancellationTemplate,
  refundProcessedTemplate,
  paymentFailedTemplate,
  subscriptionRenewalTemplate,
  wholesaleWelcomeTemplate,
  wholesaleOrderConfirmationTemplate,
  thankYouTemplate,
  reviewRequestTemplate,
  customerSurveyTemplate,
  abandonedCartTemplate,
  flashSaleTemplate,
  productLaunchTemplate,
  fundraiserKickoffTemplate,
  fundraiserUpdateTemplate,
  fundraiserMonthlyOutreachTemplate,
  monthlyNewsletterTemplate,
  eventInvitationTemplate,
  seasonalSummerTemplate,
  seasonalFallTemplate,
  seasonalHolidayTemplate,
  backInStockTemplate,
  winBackTemplate,
  birthdaySpecialTemplate,
  referralProgramTemplate,
  giftCertificateDeliveryTemplate,
  orderReadyPickupTemplate,
  announcementNewsletterTemplate,
  announcementSingleTemplate,
  orderConfirmationLightTemplate,
  orderConfirmationDarkTemplate,
  fundraiserPlatformAnnouncementTemplate,
  websiteLaunchAnnouncementTemplate,
  everythingIsLiveTemplate,
  mobileAppLaunchTemplate,
  fundraiserReferralInviteTemplate,
  heatIndexDigestTemplate,
  wholesaleProspectOutreachTemplate,
]
