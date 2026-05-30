# Quartermaster CRM — Frontend

A modern web application for managing a HEMA (Historical European Martial Arts) club/gym, built with React, TypeScript, and Vite.

## Features

- 📊 Dashboard with statistics and analytics
- 👥 Member management
- 👨‍🏫 Instructor management
- 📅 Schedule management
- 💳 Membership plans
- 🗓️ Events management
- 💰 Finance tracking (Income, Expenses, Reports)
- 📈 Analytics and reporting

## Prerequisites

- Node.js (v18 or higher recommended)
- npm (comes with Node.js)

## Quick Start

### Option 1: Using the Helper Script (Recommended)

The easiest way to run the application is using the provided helper script:

```bash
./run.sh
```

This will present you with an interactive menu:
1. Run development server
2. Build for production
3. Preview production build
4. Install dependencies
5. Clean and reinstall dependencies
6. Exit

### Option 2: Manual Commands

#### Install Dependencies

```bash
npm install
```

#### Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

#### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

#### Preview Production Build

```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── layout/      # Layout components (Header, Sidebar, etc.)
│   ├── pages/           # Page components
│   │   └── finance/     # Finance-related pages
│   ├── services/        # API service layer
│   ├── types/           # TypeScript type definitions
│   ├── lib/             # Utility functions and API client
│   ├── App.tsx          # Main application component
│   └── main.tsx         # Application entry point
├── public/              # Static assets
├── dist/                # Production build output
└── run.sh              # Helper script to run the application
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Technology Stack

- **React 18** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Build tool and dev server
- **TanStack Query** - Data fetching and caching
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Recharts** - Charting library
- **Axios** - HTTP client

## API Configuration

The application expects a backend API to be running. Configure the API endpoint in `src/lib/api-client.ts`:

```typescript
const apiClient = axios.create({
  baseURL: 'http://localhost:8000/api', // Update this to your API URL
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## Development

### Code Style

The project uses ESLint for code linting. Run the linter with:

```bash
npm run lint
```

### Type Checking

TypeScript is configured for strict type checking. The build process will fail if there are type errors.

## Building for Production

1. Build the application:
   ```bash
   npm run build
   ```

2. The production-ready files will be in the `dist` directory

3. Deploy the `dist` directory to your web server or hosting platform

## Troubleshooting

### Port Already in Use

If port 5173 is already in use, Vite will automatically try the next available port. Check the terminal output for the actual URL.

### Dependencies Issues

If you encounter dependency issues, try cleaning and reinstalling:

```bash
rm -rf node_modules package-lock.json
npm install
```

Or use the helper script option 5.

### Build Errors

Make sure all TypeScript errors are resolved before building:

```bash
npm run build
```

## License

This frontend is part of the Quartermaster CRM project.

## Support

For issues and questions, please open an issue in this repository or contact the development team.
