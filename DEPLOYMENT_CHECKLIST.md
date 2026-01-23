# Deployment Checklist

> **Instructions:** Duplicate this template for each deployment. Replace all placeholders marked with `[brackets]` with actual values.

---

## 📋 Deployment Information

**Date:** [YYYY-MM-DD]
**Time:** [HH:MM Timezone]
**Environment:** [Staging / Production]
**Deployment Type:** [Feature release / Bug fix / Hotfix / Infrastructure update]
**Deployed By:** [@username]

**Related Issues/PRs:**
- Linear Issue: [JLA-XXX] - [Issue Title]
- PR: [#XXX] - [PR Title]
- Related: [JLA-XXX, JLA-XXX] (if applicable)

**Deployment Description:**
[Brief description of what's being deployed and why]

---

## ✅ Pre-Deployment Checklist

### Code Quality & Testing
- [ ] All tests passing in CI/CD pipeline
- [ ] Code review completed and approved
- [ ] No merge conflicts or build errors
- [ ] Security scan completed (if applicable)
- [ ] Performance testing completed (if applicable)

### Reviews & Approvals
- [ ] Technical lead approval received
- [ ] Product owner sign-off (if required)
- [ ] Stakeholder notification sent

### Staging Verification
- [ ] Changes deployed to staging environment
- [ ] Staging smoke tests passed
- [ ] QA verification completed on staging
- [ ] Integration tests passed

### Dependencies
- [ ] All required dependencies updated
- [ ] Third-party service status verified
- [ ] Infrastructure prerequisites met
- [ ] Environment variables configured

---

## 🗄️ Database & Configuration Changes

### Database Migrations
- [ ] Migration scripts reviewed and tested
- [ ] Backup completed before migration
- [ ] Rollback script prepared and tested
- [ ] Migration run in staging successfully

**Migration Details:**
```
[Describe any database migrations or leave "N/A"]
```

### Configuration Changes
- [ ] Environment variables updated
- [ ] Feature flags configured
- [ ] API keys/secrets rotated (if applicable)
- [ ] CDN/cache invalidation planned

**Configuration Updates:**
```
[List any configuration changes or "N/A"]
```

---

## 📊 Monitoring & Verification Setup

### Monitoring Preparation
- [ ] Sentry monitoring active and configured
- [ ] Error tracking thresholds reviewed
- [ ] Performance monitoring enabled
- [ ] Custom alerts configured (if needed)

**Monitoring Links:**
- Sentry: [Project URL]
- Vercel Analytics: [Dashboard URL]
- Custom Monitoring: [URL if applicable]

### Metrics to Watch
- [ ] Error rate baseline documented
- [ ] Response time baseline documented
- [ ] Key user flows identified for monitoring

**Baseline Metrics:**
```
Current error rate: [X%]
Current avg response time: [XXXms]
Current active users: [XXX]
```

---

## 🚀 Post-Deployment Verification

### Immediate Checks (within 5 minutes)
- [ ] Deployment succeeded in Vercel/hosting platform
- [ ] Application is accessible
- [ ] Health check endpoints responding
- [ ] No critical errors in Sentry
- [ ] SSL certificates valid

### Functional Verification (within 15 minutes)
- [ ] Login/authentication working
- [ ] Critical user flows tested:
  - [ ] [Critical Flow 1]
  - [ ] [Critical Flow 2]
  - [ ] [Critical Flow 3]
- [ ] API endpoints responding correctly
- [ ] Database connections stable

### Performance Verification (within 30 minutes)
- [ ] Response times within acceptable range
- [ ] No memory leaks detected
- [ ] CPU usage normal
- [ ] Database query performance acceptable

### Extended Monitoring (within 2 hours)
- [ ] Error rates remain stable
- [ ] User reports monitored (support channels)
- [ ] Analytics data flowing correctly
- [ ] Background jobs running successfully

---

## 🔄 Rollback Plan

**Rollback Decision Criteria:**
- [ ] Critical functionality broken
- [ ] Error rate exceeds [X%]
- [ ] Performance degradation > [X%]
- [ ] Security vulnerability discovered

**Rollback Procedure:**
```
1. [Step-by-step rollback instructions]
2. [Vercel: Revert to previous deployment]
3. [Database: Run rollback migration if needed]
4. [Configuration: Restore previous values]
5. [Notify team and stakeholders]
```

**Rollback Contacts:**
- Technical Lead: [@username]
- DevOps: [@username]
- On-call Engineer: [@username]

**Estimated Rollback Time:** [XX minutes]

---

## 📈 Impact Assessment

### Expected Downtime
- [ ] Zero downtime deployment
- [ ] Scheduled downtime: [Duration]
- [ ] Maintenance window: [Time range]

### User Impact
- [ ] No user-facing changes
- [ ] Minor UI/UX updates
- [ ] New features available
- [ ] Potential workflow changes

**Impact Level:** [Low / Medium / High]

**Impact Description:**
```
[Describe the expected impact on users]
```

### Breaking Changes
- [ ] No breaking changes
- [ ] API version update required
- [ ] Client update required
- [ ] Data migration impacts users

**Breaking Changes Details:**
```
[List any breaking changes or "None"]
```

### Affected Services/Components
- [ ] [Service 1]
- [ ] [Service 2]
- [ ] [Component 3]

---

## 📢 Communication Checklist

### Pre-Deployment Communication
- [ ] Team notified in Slack/Teams
- [ ] Stakeholders informed via email
- [ ] Customer notice sent (if required)
- [ ] Status page updated (if applicable)

### During Deployment
- [ ] Deployment start announced
- [ ] Progress updates provided
- [ ] Issues communicated immediately

### Post-Deployment Communication
- [ ] Deployment completion announced
- [ ] Success metrics shared
- [ ] Known issues documented
- [ ] Next steps communicated

**Communication Channels:**
- Team Channel: [#channel-name]
- Status Page: [URL]
- Customer Notice: [Method]

---

## 📝 Deployment Notes

**Issues Encountered:**
```
[Document any issues found during deployment]
```

**Resolutions Applied:**
```
[Document how issues were resolved]
```

**Lessons Learned:**
```
[What went well, what could be improved]
```

---

## ✨ Sign-Off

- [ ] Deployment completed successfully
- [ ] All verification checks passed
- [ ] Monitoring confirms stability
- [ ] Documentation updated
- [ ] Team notified of completion

**Deployed By:** [@username]
**Verified By:** [@username]
**Date/Time Completed:** [YYYY-MM-DD HH:MM Timezone]

---

## 📚 References

- Linear Issue: [JLA-XXX](Linear URL)
- Pull Request: [#XXX](GitHub/GitLab URL)
- Vercel Deployment: [Deployment URL]
- Sentry Release: [Release URL]
- Documentation: [Relevant docs]
