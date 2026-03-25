# Linear GitHub Integration Setup Guide

## Overview

This document provides step-by-step instructions for configuring bidirectional Linear ↔ GitHub integration for the `jose-madrid-salsa` repository. This integration enables automatic PR tracking, issue synchronization, and streamlined workflow automation between Linear issues and GitHub pull requests.

## Repository Information

- **Repository:** `jordolang/jose-madrid-salsa`
- **Linear Workspace:** Jose Madrid Salsa
- **Issue Prefix:** JLA
- **Integration Type:** Linear GitHub App

## Prerequisites

Before starting the configuration:

- [ ] Admin access to Linear workspace
- [ ] Admin/Owner access to `jordolang/jose-madrid-salsa` GitHub repository
- [ ] Active Linear subscription with GitHub integration features enabled
- [ ] GitHub account connected to Linear workspace

## Installation Steps

### 1. Install Linear GitHub App

1. Navigate to Linear workspace settings
   - Click on workspace name in top-left
   - Select **Settings** from dropdown
   - Go to **Integrations** section

2. Find and select **GitHub** integration
   - Click **Install GitHub App**
   - You'll be redirected to GitHub authorization page

3. Authorize Linear GitHub App on GitHub
   - Select organization: `jordolang`
   - Choose repositories: Select **jose-madrid-salsa**
   - Review permissions requested:
     - Read access to code, metadata, and pull requests
     - Write access to issues, pull requests, and commit statuses
     - Webhook access for event notifications
   - Click **Install & Authorize**

4. Return to Linear
   - Confirm installation success
   - Verify `jordolang/jose-madrid-salsa` appears in connected repositories list

### 2. Configure Integration Settings

#### Branch Naming Configuration

1. In Linear GitHub integration settings, locate **Git branch naming** section
2. Set branch naming format to:
   ```
   {username}/jla-{issue-number}-{feature-name}
   ```
3. Example output: `jordan/jla-21-github-integration`

#### PR Tracking Configuration

1. Enable **Automatic PR creation from Linear issues**
   - Toggle: **ON**
   - This allows creating branches/PRs directly from Linear issues

2. Enable **PR status tracking**
   - Toggle: **ON**
   - Track status changes: draft → ready for review → merged
   - Linear will update in real-time as PR status changes

3. Configure **Automatic issue status updates**
   - Enable: **Update issue status when PR is merged**
   - Set merged PR behavior: Move issue to **Done** status
   - Enable: **Link PRs to issues automatically** (via branch name or PR description)

#### Commit and PR Linking

1. Enable **Automatic issue linking from commits**
   - Commits mentioning issue IDs (e.g., "JLA-21") will auto-link
   - Format: `JLA-XXX` in commit message

2. Enable **PR descriptions include Linear issue details**
   - Auto-populate PR description with:
     - Issue title
     - Issue description
     - Link back to Linear issue
     - Issue status and assignee

#### Webhook Configuration

1. Verify webhook endpoints are configured
   - Linear automatically configures webhooks during installation
   - Webhooks enable bidirectional sync
   - Events tracked:
     - Pull request opened/closed/merged
     - Pull request review submitted
     - Commit pushed
     - Branch created/deleted

2. Test webhook delivery (optional)
   - In GitHub repository settings → Webhooks
   - Find Linear webhook
   - Click **Recent Deliveries**
   - Verify successful delivery (200 response)

### 3. Team Settings Configuration

1. Set default branch behavior
   - Default base branch: `main`
   - Enable automatic branch creation from Linear

2. Configure PR templates (optional but recommended)
   - Create `.github/pull_request_template.md` if not exists
   - Include Linear issue reference placeholder
   - Add checklist for PR reviewers

## Testing the Integration

### Test Scenario 1: Create Branch from Linear Issue

1. Open Linear issue JLA-21 (or create test issue)
2. Click **Create branch** button in issue sidebar
3. Verify branch name follows format: `{username}/jla-{issue-number}-{feature-name}`
4. Confirm branch creation in GitHub repository
5. Verify Linear issue shows connected branch

### Test Scenario 2: Create PR and Verify Sync

1. Make a commit to the test branch
2. Create pull request on GitHub:
   - Base branch: `main`
   - Compare branch: `{username}/jla-{test-issue-number}-test`
3. Verify in Linear:
   - Issue shows connected PR
   - PR status appears in issue sidebar
   - Timeline shows PR creation event

### Test Scenario 3: PR Status Updates

1. Mark PR as draft (if not already)
   - Verify Linear shows "Draft" status
2. Mark PR as "Ready for review"
   - Verify Linear updates to "Ready for review"
3. Request review from team member
   - Verify review request appears in Linear timeline

### Test Scenario 4: PR Merge and Issue Completion

1. Approve and merge the test PR on GitHub
2. Verify in Linear:
   - Issue automatically moves to **Done** status
   - Issue timeline shows PR merge event
   - Issue shows "Completed via PR #X"

### Test Scenario 5: Commit Linking

1. Make a commit with message: "Fix bug in component JLA-21"
2. Verify commit appears in Linear issue timeline
3. Check commit includes link back to Linear issue

## Verification Checklist

After configuration, verify all features work:

- [ ] Linear GitHub App installed for `jordolang/jose-madrid-salsa`
- [ ] Branch naming format configured: `{username}/jla-{issue-number}-{feature-name}`
- [ ] Can create branches from Linear issues
- [ ] Branches automatically link to Linear issues
- [ ] PRs automatically link to Linear issues (via branch name)
- [ ] PR status updates appear in Linear in real-time
- [ ] Draft PR status shows in Linear
- [ ] Ready for review status shows in Linear
- [ ] Merged PR status shows in Linear
- [ ] PR merge automatically moves issue to "Done" status
- [ ] Commits mentioning issue IDs link automatically
- [ ] PR descriptions include Linear issue details
- [ ] Webhook endpoints active and responding
- [ ] No errors in webhook delivery logs

## Configuration Summary

| Setting | Value |
|---------|-------|
| Repository | `jordolang/jose-madrid-salsa` |
| Branch Format | `{username}/jla-{issue-number}-{feature-name}` |
| Auto PR Creation | Enabled |
| PR Status Tracking | Enabled |
| Auto Status Update on Merge | Enabled → Done |
| Commit Linking | Enabled (format: JLA-XXX) |
| PR Description Auto-fill | Enabled |
| Webhook Status | Active |

## Troubleshooting

### Issue: Branch not appearing in Linear

**Solution:**
- Verify branch name follows exact format: `{username}/jla-{issue-number}-{feature-name}`
- Check issue number is correct (e.g., JLA-21)
- Refresh Linear issue page
- Check GitHub App has read access to repository

### Issue: PR not linking to Linear issue

**Solution:**
- Verify PR branch name includes issue ID (e.g., `jla-21`)
- Add issue ID to PR description: `Fixes JLA-21`
- Manually link PR in Linear issue sidebar
- Check webhook delivery in GitHub settings

### Issue: Status not syncing

**Solution:**
- Verify webhooks are active in GitHub repository settings
- Check webhook delivery logs for errors
- Confirm Linear GitHub App has write permissions
- Try unlinking and relinking the PR

### Issue: PR merge doesn't update issue status

**Solution:**
- Verify "Auto-update on merge" setting is enabled
- Check issue is not already in Done status
- Confirm workflow state allows automatic transitions
- Manually verify webhook received merge event

## Maintenance

### Regular Checks

- **Monthly:** Verify webhook delivery success rate
- **Quarterly:** Review integration settings for team workflow changes
- **As needed:** Update branch naming format if conventions change

### Updating Configuration

To modify integration settings:
1. Go to Linear Settings → Integrations → GitHub
2. Make desired changes
3. Test with a sample issue/PR
4. Document changes in this file

### Revoking Access

If you need to remove the integration:
1. Linear Settings → Integrations → GitHub → Uninstall
2. GitHub Settings → Applications → Linear → Revoke access
3. Remove webhook from repository settings (if not auto-removed)

## Best Practices

1. **Consistent Branch Naming**
   - Always create branches from Linear issues when possible
   - Use descriptive feature names in branch names
   - Example: `jordan/jla-21-github-integration-setup`

2. **PR Descriptions**
   - Reference Linear issue in PR description
   - Use "Fixes JLA-XXX" or "Closes JLA-XXX" for automatic linking
   - Include context not captured in Linear issue

3. **Commit Messages**
   - Reference issue IDs in commits: "JLA-21: Add feature"
   - Write descriptive commit messages
   - Use conventional commit format when appropriate

4. **Status Management**
   - Let automation handle status updates when possible
   - Only manually override when automation doesn't fit workflow
   - Keep issue status in sync with actual PR state

5. **Testing Integration**
   - Test integration changes with sample issues before rolling out
   - Verify webhooks work after GitHub permission changes
   - Monitor first few PRs after configuration changes

## References

- [Linear GitHub Integration Documentation](https://linear.app/docs/github)
- [Linear API Documentation](https://developers.linear.app/)
- [GitHub Apps Documentation](https://docs.github.com/en/apps)
- [jose-madrid-salsa Repository](https://github.com/jordolang/jose-madrid-salsa)

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-28 | 1.0 | Initial configuration documentation | Auto-Claude |

---

**Note:** This is a living document. Update it whenever integration configuration changes or new features are enabled.
