# Autonomous Execution System

**José Madrid Salsa E-commerce Platform**

## Overview

This system provides **fully autonomous AI-driven development** for the José Madrid Salsa e-commerce platform. Every 5 hours, the system:

1. ✅ Analyzes the entire codebase
2. 🤖 Generates prioritized work sessions
3. 🚀 Autonomously executes tasks using Claude Code
4. 🔄 Handles errors and retries until success
5. 📦 Deploys to production on Vercel
6. ✨ Merges to main branch when verified

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CRON JOB (Every 5 hours)                │
│                   0 */5 * * * (00:00, 05:00, etc.)          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PHASE 1: Project Analysis                       │
│  scripts/analyze-project.ts                                  │
│  • Scans entire codebase                                     │
│  • Analyzes frontend/backend/database                        │
│  • Scans technical debt                                      │
│  • Generates feature suggestions                             │
│  • Creates 5-hour work session                               │
│  Output: .project-analysis/current.json                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│        PHASE 2: Autonomous Execution                         │
│  scripts/auto-execute-session.ts                             │
│  • Loads work session                                        │
│  • Generates Claude Code prompt                              │
│  • Launches Claude Code CLI                                  │
│  • Monitors execution                                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│        PHASE 3: Claude Code Execution                        │
│  • Creates feature branch                                    │
│  • Executes all tasks                                        │
│  • Commits changes                                           │
│  • Deploys to Vercel                                         │
│  • ERROR LOOP: Diagnoses and fixes until success             │
│  • Merges to main when verified                              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              PHASE 4: Production Deployment                  │
│  • Feature branch deployed and verified                      │
│  • Auto-merge to main                                        │
│  • Final production deployment                               │
│  • Cleanup feature branch                                    │
└─────────────────────────────────────────────────────────────┘
```

## Files & Components

### Analysis System
- `scripts/analyze-project.ts` - Main analyzer orchestrator
- `scripts/lib/analyzers/` - Individual analyzers
  - `frontend-analyzer.ts` - Pages, components, TypeScript
  - `backend-analyzer.ts` - API routes, auth, validation
  - `database-analyzer.ts` - Prisma models, relationships
  - `technical-debt-scanner.ts` - TODOs, console.logs, any types
  - `feature-suggester.ts` - AI-powered feature suggestions
- `scripts/lib/generators/work-session-generator.ts` - Creates 5-hour work sessions

### Autonomous Execution System
- `scripts/auto-execute-session.ts` - Main executor
- `scripts/lib/generators/claude-prompt-generator.ts` - Generates Claude prompts
- `scripts/run-analysis-cron.sh` - Cron wrapper script

### Output & Logs
- `.project-analysis/current.json` - Latest analysis
- `.project-analysis/history/` - Historical analyses
- `.project-analysis/prompts/` - Generated Claude prompts
- `logs/analyzer/cron.log` - Analysis logs
- `logs/auto-executor/cron.log` - Execution logs
- `logs/auto-executor/session-*.log` - Individual session logs

### Dashboard
- `app/admin/project-status/page.tsx` - Admin dashboard
- `components/admin/project-status/` - Dashboard components
- URL: http://localhost:3000/admin/project-status

## Configuration

### Cron Schedule
Runs every 5 hours at:
- 00:00 (midnight)
- 05:00 AM
- 10:00 AM
- 15:00 (3:00 PM)
- 20:00 (8:00 PM)

### Automation Settings
- **Mode**: Full automation (no human approval required)
- **Retry Strategy**: Infinite retries until success
- **Git Strategy**: Feature branch with auto-merge
- **Branch Pattern**: `auto/session-{N}-{timestamp}`
- **Lock Timeout**: 12 hours (stale lock cleanup)

### Safety Features
- Lock file prevents concurrent executions
- Stale lock detection (>12 hours)
- Comprehensive logging
- Feature branch workflow (not direct to main)
- Deployment verification before merge
- Error logs captured for debugging

## Usage

### Manual Execution

```bash
# Run analysis only
npm run analyze

# Run analysis and export markdown
npm run analyze -- --export markdown

# Run autonomous execution (without cron)
npm run auto-execute

# Watch mode (re-analyze on file changes)
npm run analyze:watch
```

### View Logs

```bash
# Analysis logs
tail -f logs/analyzer/cron.log

# Execution logs
tail -f logs/auto-executor/cron.log

# Specific session
tail -f logs/auto-executor/session-{N}-{timestamp}.log
```

### View Analysis Data

```bash
# Latest analysis
cat .project-analysis/current.json | jq

# Latest work session
cat .project-analysis/session-{N}.json | jq

# Generated prompt
cat .project-analysis/prompts/session-{N}-{timestamp}.md
```

### View Crontab

```bash
crontab -l
```

### Disable Automation

```bash
# Comment out the line in crontab
crontab -e

# Then add # before the line:
# 0 */5 * * * /Users/jordanlang/Repos/josemadridsalsa/scripts/run-analysis-cron.sh
```

## Error Handling

### The Infinite Retry Loop

Claude Code is instructed to NEVER give up. If deployment fails:

1. Read error logs from Vercel
2. Diagnose the root cause
3. Fix the issue in code
4. Commit the fix
5. Push to remote
6. Deploy again
7. Repeat until SUCCESS

### Common Error Scenarios

**TypeScript Errors**
```
Error: Property 'foo' does not exist on type 'Bar'
→ Fix: Add property or use optional chaining
→ Commit: "fix: add missing foo property"
→ Deploy again
```

**Build Failures**
```
Error: Module not found
→ Fix: npm install {package}
→ Commit: "fix: add missing dependency"
→ Deploy again
```

**Runtime Errors**
```
Error: Cannot read property 'x' of undefined
→ Fix: Add null checks
→ Commit: "fix: add null safety for x"
→ Deploy again
```

### Lock File Issues

If execution is stuck:
```bash
# Check lock file
cat .project-analysis/executor.lock

# If stale (>12 hours), manually remove
rm .project-analysis/executor.lock
```

## Monitoring

### Check if System is Running

```bash
# Check for lock file
ls -la .project-analysis/executor.lock

# Check latest analysis
cat .project-analysis/current.json | jq '.timestamp, .runNumber'

# Check latest logs
tail -20 logs/analyzer/cron.log
```

### View Progress

```bash
# Real-time execution log
tail -f logs/auto-executor/cron.log

# Dashboard
open http://localhost:3000/admin/project-status
```

## Git Workflow

### Feature Branch Pattern
```
auto/session-{runNumber}-{timestamp}
```

Example: `auto/session-3-20251229-152030`

### Commit Message Format
```
Autonomous Work Session #{N}: {focus}

Priority: {priority}
Tasks Completed: {count}
Estimated Time: {hours}h

Changes:
1. {task1} ({priority})
2. {task2} ({priority})
...

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

### Merge to Main
After successful deployment verification:
```bash
git checkout main
git merge --no-ff auto/session-{N}-{timestamp} -m "Merge autonomous session #{N}"
git push origin main
```

## Deployment Workflow

### 1. Feature Branch Deployment
```bash
# Deploy feature branch to Vercel
vercel --prod

# Verify deployment
vercel logs
curl {deployment-url}
```

### 2. Verification Checklist
- ✅ Deployment shows "Ready"
- ✅ No errors in Vercel logs
- ✅ Application loads successfully
- ✅ No console errors in browser

### 3. Merge & Final Deployment
```bash
# Merge to main
git checkout main
git merge --no-ff {feature-branch}
git push origin main

# Final production deployment
vercel --prod
```

## Troubleshooting

### Automation Not Running

```bash
# Check crontab
crontab -l

# Check cron logs
grep CRON /var/log/system.log

# Test script manually
./scripts/run-analysis-cron.sh
```

### Claude Code Not Found

```bash
# Install Claude Code
# Visit: https://claude.com/claude-code

# Verify installation
which claude
```

### Analysis Failing

```bash
# Run with verbose output
tsx scripts/analyze-project.ts

# Check for errors
tail -100 logs/analyzer/cron.log
```

### Execution Hanging

```bash
# Check lock file
cat .project-analysis/executor.lock

# Check if Claude Code process is running
ps aux | grep claude

# Kill if necessary
kill {pid}

# Remove lock
rm .project-analysis/executor.lock
```

## Security Considerations

### Risks
- **Autonomous code execution**: AI makes changes without human review
- **Production deployments**: Changes go live automatically
- **API costs**: Infinite retry could incur high costs
- **Breaking changes**: Could introduce bugs to production

### Mitigations
- Feature branch workflow (not direct to main)
- Comprehensive testing in feature branch before merge
- Lock file prevents concurrent executions
- Detailed logging for audit trail
- Vercel deployment verification before merge
- Stale lock detection prevents indefinite hanging

### Recommendations
- Monitor logs regularly
- Review git history for unexpected changes
- Set up Vercel deployment notifications
- Configure Sentry or error tracking
- Set up uptime monitoring for production
- Review Claude API usage/costs

## Future Enhancements

- [ ] Slack/email notifications on completion/errors
- [ ] Vercel deployment preview URLs in logs
- [ ] Automated rollback on production errors
- [ ] Cost tracking and budget limits
- [ ] Human approval gate for critical changes
- [ ] A/B testing before full production deployment
- [ ] Integration with CI/CD pipeline
- [ ] Automated tests before deployment
- [ ] Database migration safety checks

## Support

For issues or questions:
- Check logs: `logs/analyzer/` and `logs/auto-executor/`
- Review generated prompts: `.project-analysis/prompts/`
- View dashboard: http://localhost:3000/admin/project-status
- Consult Claude Code docs: https://claude.com/claude-code

---

**⚠️ WARNING**: This system performs autonomous code changes and production deployments without human approval. Use with caution and monitor closely.
