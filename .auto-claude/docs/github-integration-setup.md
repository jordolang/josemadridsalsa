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

## Test Results

> **Documentation of Actual Integration Testing**
> This section records the results of testing performed to verify the GitHub ↔ Linear integration configuration.

### Test Execution Summary

**Test Date:** [To be completed during manual testing]
**Tester:** [Name of person performing tests]
**Test Issue Used:** JLA-21 (GitHub Integration Configuration)
**Test Branch:** [Branch name created during testing]
**Test PR:** [PR number created during testing]

---

### Test Scenario 1: Create Branch from Linear Issue

**Status:** ⏳ Pending Manual Testing

**Test Steps:**
- [ ] Open Linear issue JLA-21
- [ ] Click "Create branch" button in issue sidebar
- [ ] Verify branch name matches format: `{username}/jla-21-{feature-name}`
- [ ] Confirm branch appears in GitHub repository
- [ ] Verify Linear issue displays connected branch badge
- [ ] Check branch link is clickable and navigates to GitHub

**Expected Outcome:**
- Branch created with correct naming convention
- Branch visible in both Linear and GitHub
- Branch automatically linked to Linear issue

**Actual Result:** [Pass ✅ / Fail ❌ / Blocked 🚧]

**Evidence:**
- Branch Name: `[actual branch name created]`
- GitHub URL: `[link to branch in GitHub]`
- Linear Issue URL: `[link to Linear issue showing branch]`

**Notes:** [Add any observations, issues, or deviations from expected behavior]

---

### Test Scenario 2: Create PR and Verify Sync

**Status:** ⏳ Pending Manual Testing

**Test Steps:**
- [ ] Make test commit to the branch created in Test 1
- [ ] Push commit to GitHub
- [ ] Create pull request from test branch to `main`
- [ ] Verify Linear issue shows connected PR badge
- [ ] Verify PR status appears in Linear issue sidebar
- [ ] Verify Linear timeline shows "PR created" event
- [ ] Check PR description includes Linear issue details

**Expected Outcome:**
- PR automatically linked to Linear issue
- PR badge displays in Linear issue
- PR details visible in issue sidebar
- Timeline event recorded

**Actual Result:** [Pass ✅ / Fail ❌ / Blocked 🚧]

**Evidence:**
- PR Number: `#[PR number]`
- PR URL: `[link to GitHub PR]`
- Linear Issue Status: `[current status]`
- Screenshot: `[optional - screenshot of Linear showing PR link]`

**Notes:** [Add any observations]

---

### Test Scenario 3: PR Status Updates

**Status:** ⏳ Pending Manual Testing

**Test Steps:**
- [ ] Mark PR as draft (if not already)
- [ ] Verify Linear displays "Draft" PR status
- [ ] Convert PR to "Ready for review"
- [ ] Verify Linear updates status to "Ready for review"
- [ ] Request review from team member (if available)
- [ ] Verify review request appears in Linear timeline
- [ ] Check status update latency (should be near real-time)

**Expected Outcome:**
- Draft status reflected in Linear within seconds
- Ready for review status updated in Linear
- Review requests visible in timeline
- Status changes bidirectional

**Actual Result:** [Pass ✅ / Fail ❌ / Blocked 🚧]

**Evidence:**
- Initial Status: `[draft/ready]`
- Final Status: `[current PR status]`
- Sync Latency: `[seconds to update]`
- Timeline Events: `[list of events shown]`

**Notes:** [Add any observations about sync speed or accuracy]

---

### Test Scenario 4: PR Merge and Issue Completion

**Status:** ⏳ Pending Manual Testing

**Test Steps:**
- [ ] Approve test PR on GitHub (if reviews enabled)
- [ ] Merge test PR into `main` branch
- [ ] Verify Linear issue automatically moves to "Done" status
- [ ] Verify Linear timeline shows "PR merged" event
- [ ] Verify issue displays "Completed via PR #X" message
- [ ] Check merge commit appears in Linear issue
- [ ] Confirm automation completed within expected timeframe

**Expected Outcome:**
- Issue status automatically updated to "Done"
- Merge event recorded in timeline
- Completion message displayed
- No manual intervention required

**Actual Result:** [Pass ✅ / Fail ❌ / Blocked 🚧]

**Evidence:**
- Pre-merge Issue Status: `[status before merge]`
- Post-merge Issue Status: `[status after merge]`
- Merge Time: `[timestamp]`
- Status Update Time: `[timestamp]`
- Automation Latency: `[seconds between merge and status update]`

**Notes:** [Add observations about automation reliability]

---

### Test Scenario 5: Commit Linking

**Status:** ⏳ Pending Manual Testing

**Test Steps:**
- [ ] Create commit with message including issue ID: `"Test commit for JLA-21 integration"`
- [ ] Push commit to GitHub
- [ ] Verify commit appears in Linear issue timeline
- [ ] Verify commit message is clickable
- [ ] Verify clicking commit navigates to GitHub
- [ ] Test alternative format: `"JLA-21: Another test commit"`
- [ ] Confirm both formats link correctly

**Expected Outcome:**
- Commits mentioning JLA-21 automatically link
- Commits appear in Linear timeline
- Links navigate to correct GitHub commit

**Actual Result:** [Pass ✅ / Fail ❌ / Blocked 🚧]

**Evidence:**
- Commit SHA: `[commit hash]`
- Commit Message: `[actual message used]`
- GitHub Commit URL: `[link]`
- Linear Timeline: `[screenshot or description]`

**Notes:** [Add observations about commit linking behavior]

---

### Overall Test Summary

| Test Scenario | Status | Result | Notes |
|--------------|--------|--------|-------|
| 1. Create Branch from Linear | ⏳ Pending | - | - |
| 2. Create PR and Verify Sync | ⏳ Pending | - | - |
| 3. PR Status Updates | ⏳ Pending | - | - |
| 4. PR Merge and Issue Completion | ⏳ Pending | - | - |
| 5. Commit Linking | ⏳ Pending | - | - |

**Total Tests:** 5
**Passed:** 0
**Failed:** 0
**Blocked:** 0
**Not Tested:** 5

---

### Issues Identified During Testing

[Document any issues, bugs, or configuration problems discovered during testing. If none, state "No issues identified."]

**Issue 1:**
- **Description:** [What went wrong]
- **Impact:** [High/Medium/Low]
- **Workaround:** [Temporary solution if available]
- **Resolution:** [How it was fixed, or "Open"]

**Issue 2:**
- [Add more as needed]

---

### Post-Testing Configuration Adjustments

[Document any changes made to integration settings based on test results]

**Adjustment 1:**
- **Setting Changed:** [Name of setting]
- **Old Value:** [Previous value]
- **New Value:** [New value]
- **Reason:** [Why change was needed]

---

### Recommendations

Based on testing results, the following recommendations are made:

1. **[Recommendation Category]**
   - [Specific recommendation]
   - [Rationale]
   - [Priority: High/Medium/Low]

2. **[Additional recommendations as needed]**

---

### Sign-off

**Integration Testing Completed By:** [Name]
**Date:** [Date]
**Status:** [Approved ✅ / Issues Require Resolution ❌]
**Next Steps:** [Any follow-up actions needed]

---

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
