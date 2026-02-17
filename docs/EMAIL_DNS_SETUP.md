# Email DNS Configuration for josemadrid.net

This document provides instructions for configuring SPF and DKIM DNS records to authenticate emails sent from josemadrid.net using Resend. Proper DNS configuration is essential for email deliverability and prevents emails from being marked as spam.

## Overview

Email authentication helps email providers (Gmail, Outlook, Yahoo, etc.) verify that emails are legitimately sent from your domain. Two key authentication methods are:

1. **SPF (Sender Policy Framework)** - Specifies which mail servers are authorized to send email on behalf of your domain
2. **DKIM (DomainKeys Identified Mail)** - Adds a digital signature to emails that can be verified using a public key in your DNS

## Why DNS Configuration is Important

Without proper DNS authentication:
- Emails may be marked as spam or rejected
- Your domain's sender reputation can be damaged
- Delivery rates will be significantly lower (<50% instead of >95%)
- Some email providers may block emails entirely

## Required DNS Records

### 1. SPF Record

The SPF record tells email receivers which mail servers are authorized to send email from your domain.

**Record Type:** TXT
**Host/Name:** `@` (or leave blank, depending on your DNS provider)
**Value:**
```txt
v=spf1 include:_spf.resend.com ~all
```

**Explanation:**
- `v=spf1` - SPF version 1
- `include:_spf.resend.com` - Authorize Resend's mail servers
- `~all` - Soft fail for servers not listed (recommended for testing)

**Note:** If you already have an SPF record, you'll need to add `include:_spf.resend.com` to it. Each domain can only have one SPF record.

### 2. DKIM Record

DKIM adds a cryptographic signature to your emails. The public key is stored in DNS, and Resend signs emails with the private key.

**Record Type:** TXT
**Host/Name:** `resend._domainkey` (or `resend._domainkey.josemadrid.net`)
**Value:** *(Obtained from Resend Dashboard - see instructions below)*

The DKIM value will look similar to:
```txt
v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
```

## Setup Instructions

### Step 1: Access Resend Dashboard

1. Log into your Resend account at [resend.com](https://resend.com)
2. Navigate to **Domains** in the left sidebar
3. Click **Add Domain** (or select `josemadrid.net` if already added)

### Step 2: Get DNS Records from Resend

Resend will display the required DNS records for your domain:

1. **SPF Record:**
   - Record Type: TXT
   - Host: `@`
   - Value: `v=spf1 include:_spf.resend.com ~all`

2. **DKIM Record:**
   - Record Type: TXT
   - Host: `resend._domainkey`
   - Value: *(Copy the full value from Resend dashboard)*

3. **Optional - DMARC Record:**
   - Record Type: TXT
   - Host: `_dmarc`
   - Value: `v=DMARC1; p=none; rua=mailto:dmarc@josemadrid.net`

### Step 3: Add Records to DNS Provider

The exact steps depend on your DNS provider. Below are instructions for common providers:

#### GoDaddy

1. Log into your [GoDaddy account](https://www.godaddy.com)
2. Go to **My Products** > **DNS**
3. Click **Manage DNS** for josemadrid.net
4. Scroll to **Records** section
5. Click **Add** to create new records:

   **SPF Record:**
   - Type: TXT
   - Name: `@`
   - Value: `v=spf1 include:_spf.resend.com ~all`
   - TTL: 1 Hour (or default)

   **DKIM Record:**
   - Type: TXT
   - Name: `resend._domainkey`
   - Value: *(paste from Resend dashboard)*
   - TTL: 1 Hour (or default)

6. Click **Save**

#### Cloudflare

1. Log into [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select the josemadrid.net domain
3. Go to **DNS** > **Records**
4. Click **Add record** for each:

   **SPF Record:**
   - Type: TXT
   - Name: `@`
   - Content: `v=spf1 include:_spf.resend.com ~all`
   - Proxy status: DNS only (gray cloud)
   - TTL: Auto

   **DKIM Record:**
   - Type: TXT
   - Name: `resend._domainkey`
   - Content: *(paste from Resend dashboard)*
   - Proxy status: DNS only (gray cloud)
   - TTL: Auto

5. Click **Save**

#### Namecheap

1. Log into [Namecheap](https://www.namecheap.com)
2. Go to **Domain List** > select josemadrid.net
3. Click **Manage** > **Advanced DNS**
4. Under **Host Records**, click **Add New Record**:

   **SPF Record:**
   - Type: TXT Record
   - Host: `@`
   - Value: `v=spf1 include:_spf.resend.com ~all`
   - TTL: Automatic

   **DKIM Record:**
   - Type: TXT Record
   - Host: `resend._domainkey`
   - Value: *(paste from Resend dashboard)*
   - TTL: Automatic

5. Click the green checkmark to save

#### Other DNS Providers

For other providers (AWS Route 53, Google Domains, etc.), the general steps are:

1. Access your DNS management console
2. Create a TXT record with host `@` and the SPF value
3. Create a TXT record with host `resend._domainkey` and the DKIM value
4. Save changes

### Step 4: Wait for DNS Propagation

DNS changes can take anywhere from a few minutes to 48 hours to propagate globally. Typically:
- **5-30 minutes** for most providers
- **Up to 24 hours** in some cases
- **48 hours maximum** (rare)

### Step 5: Verify in Resend Dashboard

1. Return to the Resend Dashboard > Domains
2. Wait for the verification status to update
3. You should see green checkmarks next to:
   - ✓ SPF Record
   - ✓ DKIM Record
4. Once verified, the domain status will show **Verified**

**Note:** You can click the **Verify** button in Resend to manually trigger a DNS check if needed.

## Verification Commands

You can verify your DNS records are properly configured using command-line tools:

### Verify SPF Record

```bash
# macOS/Linux
dig TXT josemadrid.net +short

# Windows (PowerShell)
Resolve-DnsName -Name josemadrid.net -Type TXT

# Expected output should include:
# "v=spf1 include:_spf.resend.com ~all"
```

### Verify DKIM Record

```bash
# macOS/Linux
dig TXT resend._domainkey.josemadrid.net +short

# Windows (PowerShell)
Resolve-DnsName -Name resend._domainkey.josemadrid.net -Type TXT

# Expected output should include:
# "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ..."
```

### Online Verification Tools

You can also use online tools to verify your DNS records:
- [MXToolbox](https://mxtoolbox.com/spf.aspx) - SPF Record Lookup
- [DKIM Validator](https://dkimvalidator.com/) - DKIM Record Lookup
- [DMARCian](https://dmarcian.com/dmarc-inspector/) - Full email authentication check

## Testing Email Authentication

After DNS records are verified, send a test email and check the headers:

### Gmail

1. Send a test email to your Gmail account
2. Open the email in Gmail
3. Click the three dots (⋮) > **Show original**
4. Look for these authentication results:
```txt
   SPF: PASS with IP xxx.xxx.xxx.xxx
   DKIM: 'PASS' with domain resend.com
   DMARC: 'PASS'
   ```

### Outlook

1. Send a test email to your Outlook account
2. Open the email
3. Right-click > **View message source**
4. Look for `Authentication-Results` header with PASS status

### Mail-Tester

For a comprehensive deliverability test:

1. Visit [mail-tester.com](https://www.mail-tester.com)
2. Note the unique email address provided
3. Send a test email from your application to that address
4. Check the score (aim for 10/10)
5. Review the detailed report for any issues

## Troubleshooting

### Domain Not Verifying in Resend

**Issue:** Resend shows red X next to SPF/DKIM records

**Solutions:**
- Wait longer for DNS propagation (up to 24 hours)
- Double-check the record values match exactly what Resend provided
- Ensure there are no extra spaces or characters in the DNS values
- Verify the host names are correct (`@` for SPF, `resend._domainkey` for DKIM)
- Some DNS providers require fully qualified domain names (e.g., `resend._domainkey.josemadrid.net`)

### Multiple SPF Records

**Issue:** Your domain already has an SPF record for another service

**Solution:**
Do NOT create a second SPF record. Instead, modify the existing one:

```txt
# Old SPF record:
v=spf1 include:_spf.google.com ~all

# Updated SPF record (add Resend):
v=spf1 include:_spf.google.com include:_spf.resend.com ~all
```

### Emails Still Going to Spam

**Possible Causes:**
1. **DNS records not propagated yet** - Wait 24 hours
2. **Domain reputation** - New domains may have lower trust
3. **Email content** - Avoid spam trigger words, include unsubscribe link
4. **Low engagement** - If recipients don't open emails, providers may filter them
5. **Missing DMARC** - Add a DMARC record (see Optional Records below)

### DKIM Signature Failure

**Issue:** Emails show `DKIM: 'FAIL'` in headers

**Solutions:**
- Verify the DKIM DNS record is correctly set
- Check that you copied the full DKIM value (it's very long)
- Ensure there are no line breaks in the DKIM value
- Some DNS providers require you to escape special characters

## Optional: DMARC Configuration

DMARC (Domain-based Message Authentication, Reporting, and Conformance) builds on SPF and DKIM to provide additional protection.

**Record Type:** TXT
**Host/Name:** `_dmarc`
**Value:**
```txt
v=DMARC1; p=none; rua=mailto:dmarc@josemadrid.net
```

**DMARC Policy Options:**
- `p=none` - Monitor only (recommended to start)
- `p=quarantine` - Mark suspicious emails as spam
- `p=reject` - Reject unauthenticated emails (most strict)

**Recommendation:** Start with `p=none` to monitor, then gradually move to stricter policies as you verify everything is working correctly.

## Environment Variables

Ensure these environment variables are properly set:

```bash
# .env.local (development)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
FROM_EMAIL="orders@josemadrid.net"

# .env.production (production)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"
FROM_EMAIL="orders@josemadrid.net"
```

**Important:** Only use verified domains in production. For testing, you can use `onboarding@resend.dev`.

## Security Best Practices

1. **Never commit API keys** to version control
   - Use `.env.local` for local development
   - Use environment variables in production (Vercel, etc.)

2. **Use strict SPF policies**
   - After testing with `~all`, consider upgrading to `-all` (hard fail)

3. **Monitor DMARC reports**
   - Set up `rua=mailto:dmarc@josemadrid.net` to receive weekly reports
   - Review reports for unauthorized sending attempts

4. **Rotate API keys periodically**
   - Generate new Resend API keys every 6-12 months
   - Delete old keys after rotation

5. **Keep DNS records up to date**
   - Review DNS records quarterly
   - Remove outdated or unused records

## Sender Domains Best Practices

### Recommended Email Addresses

Use role-based email addresses for different purposes:

- `orders@josemadrid.net` - Order confirmations
- `shipping@josemadrid.net` - Shipping notifications
- `support@josemadrid.net` - Customer support
- `info@josemadrid.net` - General contact form emails
- `noreply@josemadrid.net` - System notifications (use sparingly)

### Avoid Using

- Generic addresses like `admin@`, `webmaster@`
- Personal email addresses
- `noreply@` for transactional emails (poor user experience)

## Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend Domain Verification Guide](https://resend.com/docs/dashboard/domains/introduction)
- [SPF Record Syntax](https://www.rfc-editor.org/rfc/rfc7208)
- [DKIM Documentation](https://www.rfc-editor.org/rfc/rfc6376)
- [DMARC Guide](https://dmarc.org/overview/)
- [Email Authentication Best Practices](https://www.m3aawg.org/sites/default/files/m3aawg-email-authentication-recommended-best-practices-09-2020.pdf)

## Support

If you encounter issues:

1. **Check Resend Documentation:** [resend.com/docs](https://resend.com/docs)
2. **Resend Support:** Available in dashboard or via email
3. **DNS Provider Support:** Contact your domain registrar's support team
4. **Test Tools:** Use mail-tester.com to diagnose deliverability issues

## Checklist

Before sending production emails, verify:

- [ ] SPF record added to DNS
- [ ] DKIM record added to DNS
- [ ] DNS records verified in Resend dashboard
- [ ] Domain status shows "Verified" in Resend
- [ ] Test email sent and received successfully
- [ ] Test email shows SPF: PASS and DKIM: PASS in headers
- [ ] Mail-tester.com score is 8/10 or higher
- [ ] `FROM_EMAIL` environment variable uses verified domain
- [ ] Unsubscribe links are present in all emails
- [ ] RESEND_API_KEY is securely stored (not in git)

Once all items are checked, your email infrastructure is ready for production use!
