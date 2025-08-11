#!/bin/bash

echo "Starting local server for Sup Dinner App..."
echo "Visit http://localhost:8000 in your browser"
echo "Press Ctrl+C to stop the server"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    echo "Using Python 3 server..."
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    echo "Using Python server..."
    python -m SimpleHTTPServer 8000
else
    echo "Python not found. Please install Python or use another local server."
    echo "Alternative: Use VS Code Live Server extension or any other local server."
fi
