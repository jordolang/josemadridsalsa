# Repository Security Setup

Complete security configuration for Jlang.dev repositories with CodeQL scanning and secret prevention.

## Features

✅ **CodeQL Security Scanning** - Automated code analysis for vulnerabilities  
✅ **Secret Detection** - Multiple layers of API key and credential protection  
✅ **Pre-commit Hooks** - Local prevention of secret commits  
✅ **GitHub Actions Integration** - Automated CI/CD security checks  
✅ **Dependency Monitoring** - Track vulnerable packages  

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Pre-commit Hooks

```bash
npm run prepare
```

### 3. Install Gitleaks (for local scanning)

**macOS:**
```bash
brew install gitleaks
```

**Linux:**
```bash
# Download latest release
wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
sudo mv gitleaks /usr/local/bin/
```

**Windows:**
```bash
# Using Chocolatey
choco install gitleaks

# Or download from GitHub releases
```

### 4. Copy Workflows to Your Repository

```bash
# Copy the .github folder to your repository root
cp -r .github /path/to/your/repository/

# Copy security configs
cp .gitleaks.toml /path/to/your/repository/
cp .pre-commit-config.yaml /path/to/your/repository/
cp SECURITY.md /path/to/your/repository/
cp .gitignore /path/to/your/repository/
```

### 5. Enable GitHub Security Features

1. Go to your repository **Settings**
2. Navigate to **Security & analysis**
3. Enable:
   - ✅ Dependency graph
   - ✅ Dependabot alerts
   - ✅ Dependabot security updates
   - ✅ Secret scanning
   - ✅ Push protection

## Usage

### Local Secret Scanning

Before committing:
```bash
npm run security:scan
```

### Protect Staged Changes

Check staged files for secrets:
```bash
npm run security:protect
```

### Generate Security Baseline

Create a baseline report:
```bash
npm run security:baseline
```

## GitHub Actions Workflows

### CodeQL Analysis
- Runs on: Push, Pull Request, Weekly schedule
- Languages: JavaScript, TypeScript
- Queries: Security-extended and quality checks

### Secret Scanning
- Runs on: Every push and PR
- Tools: TruffleHog + Gitleaks
- Detects: API keys, tokens, credentials

## Detected Secret Types

- Vercel API tokens
- Google API keys (Maps, Places)
- Stripe keys (test & live)
- GitHub tokens (PAT, OAuth, App)
- NPM tokens
- Generic API keys
- Environment variable exposures

## Environment Variables Best Practices

### Local Development

Create a `.env.local` file (never commit):
```bash
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your_key_here
VERCEL_TOKEN=your_token_here
```

### Vercel Deployment

Add environment variables in Vercel dashboard:
1. Go to Project Settings
2. Navigate to Environment Variables
3. Add variables for each environment

### Example `.env.example`

Create this file to document required variables:
```bash
# Google Places API
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=

# Vercel
VERCEL_TOKEN=

# Add other required variables
```

## Troubleshooting

### Pre-commit Hook Fails

If the hook prevents your commit:
1. Review the flagged files
2. Remove any secrets
3. Use environment variables instead
4. Try committing again

### False Positives

Edit `.gitleaks.toml` to add to allowlist:
```toml
[allowlist]
regexes = [
  '''YOUR_EXAMPLE_STRING'''
]
```

### Skip Hooks (Emergency Only)

```bash
git commit --no-verify -m "your message"
```

**⚠️ Use sparingly and scan manually afterward!**

## Additional Security

### Vercel-Specific

- Use environment variables for all secrets
- Enable "Deployment Protection" in Vercel
- Restrict API to specific domains
- Use different keys per environment

### GitHub-Specific

- Enable branch protection rules
- Require status checks to pass
- Require pull request reviews
- Enable "Require signed commits"

## Support

For security issues, see [SECURITY.md](./SECURITY.md)

---

**Built for Jlang.dev** | Protecting your code and credentials
