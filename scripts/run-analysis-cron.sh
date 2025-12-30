#!/bin/bash
# Automated Project Analysis + Autonomous Execution Cron Job
# José Madrid Salsa E-commerce Platform

# Set working directory
cd /Users/jordanlang/Repos/josemadridsalsa

# Set PATH to include node/npm
export PATH="/usr/local/bin:$PATH"

# Load environment variables from .env.local
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | xargs)
fi

# Create logs directory if it doesn't exist
mkdir -p logs/analyzer
mkdir -p logs/auto-executor

# Run analysis with timestamp
echo "====================================" >> logs/analyzer/cron.log
echo "Analysis started at $(date)" >> logs/analyzer/cron.log
echo "====================================" >> logs/analyzer/cron.log

# Run the analysis
/usr/local/bin/npm run analyze >> logs/analyzer/cron.log 2>&1

# Log completion
echo "Analysis completed at $(date)" >> logs/analyzer/cron.log
echo "" >> logs/analyzer/cron.log

# Check if analysis succeeded
if [ $? -eq 0 ]; then
  echo "====================================" >> logs/analyzer/cron.log
  echo "Starting autonomous execution at $(date)" >> logs/analyzer/cron.log
  echo "====================================" >> logs/analyzer/cron.log

  # Run autonomous execution
  /usr/local/bin/npm run auto-execute >> logs/auto-executor/cron.log 2>&1

  # Log autonomous execution completion
  echo "Autonomous execution completed at $(date)" >> logs/analyzer/cron.log
  echo "" >> logs/analyzer/cron.log
else
  echo "⚠️  Analysis failed, skipping autonomous execution" >> logs/analyzer/cron.log
  echo "" >> logs/analyzer/cron.log
fi
