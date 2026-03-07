# KhataBot

A WhatsApp-based expense tracker powered by Claude AI extraction. Automatically parse transaction messages and organize them by group, contact, and category.

## Features

- Message-based transaction entry via WhatsApp
- Claude AI text and image recognition for automatic data extraction
- Group and contact management
- Transaction dashboard with filters and reports
- Payment mode and category tracking
- Image attachment support for receipts and UPI screenshots

## Quick Start

### Prerequisites

- Node.js 22.x LTS
- npm 10.x
- Supabase project (with PostgreSQL)
- Anthropic Claude API key
- WhatsApp account

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd khatabot
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env.local
```
Then edit `.env.local` with your credentials.

4. Apply database migrations:
```bash
supabase migration up
```

5. Start development servers:
```bash
# Terminal 1: Web dashboard
npm run dev

# Terminal 2: WhatsApp bot
npm run bot:dev
```

## Architecture

See ARCHITECTURE.md and docs/PHASE_1_PLANNING.md for detailed system design.

## Development Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run bot:dev` - Start bot with file watching
- `npm run bot:start` - Start bot once
- `npm run type-check` - Run TypeScript compiler
- `npm run lint` - Run ESLint

## Deployment

Designed for Railway.app with two services (web + bot).

## License

Private project.
