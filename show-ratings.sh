#!/bin/bash

# Script to extract and display ratings from logs

echo "=== RECENT TOKEN RATINGS ==="
echo ""

# Look for rating logs in the last run
if [ -f "logs/memecoin-analyzer-$(date +%Y-%m-%d).log" ]; then
    echo "Extracting ratings from today's log file..."
    
    # Extract initial ratings
    echo "Initial Technical Ratings:"
    grep "Initial technical rating calculated" logs/memecoin-analyzer-$(date +%Y-%m-%d).log | \
        jq -r 'select(.initialRating) | "\(.message | split(" for ")[1]): \(.initialRating)/10"' 2>/dev/null || \
        echo "No rating data found in JSON format"
    
    echo ""
    echo "Final Ratings (after AI enhancement):"
    grep "Enhanced rating calculation completed" logs/memecoin-analyzer-$(date +%Y-%m-%d).log | \
        jq -r 'select(.finalRating) | "\(.message | split(" for ")[1]): \(.finalRating)/10 (AI used: \(.aiAnalysisUsed))"' 2>/dev/null || \
        echo "No enhanced rating data found in JSON format"
else
    echo "No log file found for today. Checking console output format..."
fi

echo ""
echo "=== CHECKING CURRENT LOG FORMAT ==="

# Check if we're using JSON logging
if [ "$LOG_FORMAT" = "json" ] || [ -z "$LOG_FORMAT" ]; then
    echo "❌ Console is NOT showing rating numbers because:"
    echo "   - The current format only shows message text"
    echo "   - Rating values are in metadata which is hidden"
    echo ""
    echo "To see ratings, either:"
    echo "1. Use detailed logging: LOG_FORMAT=detailed npm start"
    echo "2. Check the log files: tail -f logs/*.log | jq ."
    echo "3. Use simplified logging: ./start-simple.sh"
fi