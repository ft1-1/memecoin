#!/bin/bash

# Start the Memecoin Analyzer with simplified console output

echo "Starting Memecoin Analyzer with simplified logging..."
echo ""

# Set environment for simple logging
export LOG_FORMAT=simple
export NODE_ENV=production

# Set log level to reduce technical output
export LOG_LEVEL=info

# Run the application
npm start