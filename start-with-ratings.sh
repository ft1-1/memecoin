#!/bin/bash

# Start the Memecoin Analyzer showing ratings in console

echo "Starting Memecoin Analyzer with visible ratings..."
echo ""

# Set environment to show detailed logs with metadata
export LOG_FORMAT=detailed
export NODE_ENV=development

# This will show logs like:
# 2025-08-11T18:45:23.456Z [info]: Initial technical rating calculated for KORI {
#   "tokenAddress": "...",
#   "initialRating": "6.2",
#   "confidence": "75.5",
#   "recommendation": "HOLD"
# }

# Run the application
npm start