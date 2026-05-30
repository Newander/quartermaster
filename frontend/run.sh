#!/bin/bash

# Quartermaster Frontend - Run Script
# This script helps you run the frontend application

set -e

echo "🏃 Quartermaster Frontend Runner"
echo "================================"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Function to show menu
show_menu() {
    echo "Select an option:"
    echo "1) Run development server"
    echo "2) Build for production"
    echo "3) Preview production build"
    echo "4) Install dependencies"
    echo "5) Clean and reinstall dependencies"
    echo "6) Exit"
    echo ""
    read -p "Enter your choice [1-6]: " choice
}

# Main loop
while true; do
    show_menu
    
    case $choice in
        1)
            echo ""
            echo "🚀 Starting development server..."
            echo "The app will be available at http://localhost:5173"
            echo "Press Ctrl+C to stop the server"
            echo ""
            npm run dev
            ;;
        2)
            echo ""
            echo "🔨 Building for production..."
            npm run build
            echo ""
            echo "✅ Build complete! Files are in the 'dist' directory"
            echo ""
            ;;
        3)
            echo ""
            echo "👀 Starting preview server..."
            echo "Make sure you've built the project first (option 2)"
            echo ""
            npm run preview
            ;;
        4)
            echo ""
            echo "📦 Installing dependencies..."
            npm install
            echo ""
            echo "✅ Dependencies installed!"
            echo ""
            ;;
        5)
            echo ""
            echo "🧹 Cleaning node_modules..."
            rm -rf node_modules package-lock.json
            echo "📦 Reinstalling dependencies..."
            npm install
            echo ""
            echo "✅ Clean install complete!"
            echo ""
            ;;
        6)
            echo ""
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo ""
            echo "❌ Invalid option. Please try again."
            echo ""
            ;;
    esac
done
