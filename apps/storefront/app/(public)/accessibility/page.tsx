import type { Metadata } from 'next';
import { createMetadata } from '@/lib/metadata';

export const dynamic = 'force-dynamic'

export const metadata: Metadata = createMetadata({
  title: 'Accessibility Statement - Jose Madrid Salsa',
  description: 'Jose Madrid Salsa is committed to making our website accessible to all users.',
  pathname: '/accessibility',
});

export default function AccessibilityPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-6">Accessibility Statement</h1>
          <p className="text-sm text-muted-foreground mb-10">Last updated: {new Date().getFullYear()}</p>

          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p>
              Jose Madrid Salsa is committed to ensuring digital accessibility for people with disabilities. We are
              continually improving the user experience for everyone and applying the relevant accessibility standards
              to achieve these goals.
            </p>

            <h2>Our Commitment</h2>
            <p>
              We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These
              guidelines explain how to make web content more accessible for people with disabilities and user-friendly
              for everyone.
            </p>

            <h2>Accessibility Features</h2>
            <p>Our website includes the following accessibility features:</p>
            <ul>
              <li>Semantic HTML structure for screen readers</li>
              <li>Alternative text for images and visual content</li>
              <li>Keyboard navigation support</li>
              <li>Sufficient color contrast for text readability</li>
              <li>Responsive design that works on various devices and screen sizes</li>
              <li>Clear headings and labels for form elements</li>
              <li>Focus indicators for keyboard navigation</li>
            </ul>

            <h2>Areas for Improvement</h2>
            <p>
              We recognize that some parts of our website may not be fully accessible. We are actively working to
              improve accessibility across all pages and features. If you encounter any accessibility barriers, please
              let us know.
            </p>

            <h2>Feedback and Assistance</h2>
            <p>
              We welcome your feedback on the accessibility of our website. If you encounter accessibility barriers or
              have suggestions for improvement, please contact us:
            </p>
            <ul>
              <li>
                <strong>Email</strong>: <a href="mailto:mike@josemadridsalsa.com">mike@josemadridsalsa.com</a>
              </li>
              <li>
                <strong>Phone</strong>: (740) 521-4304
              </li>
            </ul>
            <p>
              When contacting us, please include:
            </p>
            <ul>
              <li>The web page or content where you encountered the issue</li>
              <li>A description of the accessibility problem</li>
              <li>Your preferred method of contact</li>
            </ul>
            <p>
              We aim to respond to accessibility feedback within 5 business days.
            </p>

            <h2>Third-Party Content</h2>
            <p>
              Some content on our website may be provided by third parties (such as embedded videos, maps, or social
              media widgets). While we strive to ensure all content is accessible, we may not have full control over
              third-party accessibility features.
            </p>

            <h2>Ongoing Efforts</h2>
            <p>
              We regularly review our website for accessibility issues and work to address them. Our accessibility
              efforts include:
            </p>
            <ul>
              <li>Regular accessibility audits and testing</li>
              <li>Training for our team on accessibility best practices</li>
              <li>Incorporating accessibility considerations into our development process</li>
              <li>Staying current with accessibility standards and guidelines</li>
            </ul>

            <h2>Assistive Technologies</h2>
            <p>
              Our website is designed to work with common assistive technologies, including:
            </p>
            <ul>
              <li>Screen readers (e.g., JAWS, NVDA, VoiceOver)</li>
              <li>Screen magnification software</li>
              <li>Voice recognition software</li>
              <li>Alternative input devices</li>
            </ul>

            <h2>Updates</h2>
            <p>
              This accessibility statement will be reviewed and updated regularly to reflect our ongoing commitment and
              progress. The "Last updated" date at the top of this page indicates when this statement was last revised.
            </p>

            <h2>Contact</h2>
            <p>
              For questions about accessibility or to report issues, please contact us at
              <a href="mailto:mike@josemadridsalsa.com"> mike@josemadridsalsa.com</a> or call (740) 521-4304.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

