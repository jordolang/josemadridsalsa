# Security Policy

## Supported Versions

We take security seriously at Jlang.dev. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |
| < Latest| :x:                |

## Security Measures

### Automated Security Scanning

This repository employs multiple layers of security scanning:

1. **CodeQL Analysis** - Runs on every push and PR to detect security vulnerabilities in code
2. **Secret Scanning** - Prevents API keys and credentials from being committed
3. **Dependency Scanning** - Monitors for vulnerable dependencies (via Dependabot)

### Secret Detection

We use multiple tools to prevent credential leaks:

- **Gitleaks** - Scans for hardcoded secrets and API keys
- **TruffleHog** - Detects and verifies leaked credentials
- **Pre-commit hooks** - Prevents secrets from being committed locally

### Protected API Keys

The following API keys are actively monitored:

- Vercel deployment tokens
- Google Places API keys
- Google Maps API keys
- Stripe API keys
- GitHub tokens
- NPM tokens
- Generic API keys and secrets

## Reporting a Vulnerability

If you discover a security vulnerability, please follow these steps:

1. **Do NOT** open a public issue
2. Email security concerns to: [your-email@jlang.dev]
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Resolution**: Varies by severity (critical issues prioritized)

## Best Practices for Contributors

### Environment Variables

Never commit files containing secrets:

- `.env`
- `.env.local`
- `.env.development`
- `.env.production`
- Any configuration files with API keys

### Local Development

1. Install pre-commit hooks: `npm install && npm run prepare`
2. Run security scan before pushing: `npm run security:scan`
3. Use environment variables for all sensitive data
4. Add `.env*` to `.gitignore`

### API Key Management

- Store API keys in Vercel environment variables
- Use different keys for development and production
- Rotate keys immediately if exposed
- Use key restrictions (IP, domain, API limits)

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve our security posture.
