# Overview

This is a professional fintech application for business customers, inspired by Revolut but with enhanced UX and modern technologies. It's a full-stack web application built with React/TypeScript frontend, Express.js backend, and PostgreSQL database with Drizzle ORM. The application provides secure business banking features including account management, transactions, invoice payments, and KYC/AML compliance.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript and Vite for fast development
- **Styling**: TailwindCSS with shadcn/ui component library for professional UI
- **State Management**: TanStack Query (React Query) for server state and caching
- **Routing**: Wouter for lightweight client-side routing
- **Authentication**: Session-based with Replit Auth integration

## Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit Auth with Passport.js and OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Security**: Helmet for security headers, rate limiting, CSRF protection

## Database Design
The database uses PostgreSQL with the following key tables:
- `users` - User profiles and authentication data
- `companies` - Business entities with KYC status
- `accounts` - Bank accounts linked to companies
- `transactions` - Financial transaction records
- `invoices` - Invoice management and payment tracking
- `sessions` - User session storage for authentication

# Key Components

## Authentication System
- Uses Replit Auth for secure user authentication
- OpenID Connect integration for token-based auth
- Session-based authentication with PostgreSQL storage
- Role-based access control (user/admin roles)

## Dashboard Features
- Account balance overview and summary cards
- Recent transaction history with filtering
- Invoice payment functionality with KID number support
- Quick actions for transfers and exports
- Mobile-responsive design with Tailwind breakpoints

## Admin Panel
- Company verification and KYC status management
- User management and role assignment
- Transaction monitoring and oversight
- Batch operations for administrative tasks

## Security Implementation
- Rate limiting on API endpoints (100 requests/15min general, 10 requests/5min for payments)
- Helmet.js for security headers
- Input validation with Zod schemas
- CSRF protection and secure session handling
- Environment variable management for sensitive data

# Data Flow

## Authentication Flow
1. User initiates login via `/api/login`
2. Replit Auth handles OpenID Connect flow
3. User data stored/updated in PostgreSQL
4. Session created and stored in database
5. Frontend receives user data via `/api/auth/user`

## Transaction Flow
1. User initiates payment through dashboard
2. Backend validates input and checks permissions
3. Transaction record created in database
4. Account balances updated atomically
5. Frontend receives confirmation and updates UI

## KYC/AML Integration
- SumSub integration prepared for identity verification
- Webhook endpoints ready for KYC status updates
- Company verification workflow with admin approval
- Compliance data stored securely in database

# External Dependencies

## Database & Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **Drizzle ORM**: Type-safe database operations
- **Database Migrations**: Managed through drizzle-kit

## Authentication & Security
- **Replit Auth**: Primary authentication provider
- **OpenID Connect**: Token-based authentication
- **Passport.js**: Authentication middleware

## UI & Styling
- **shadcn/ui**: Pre-built accessible components
- **Radix UI**: Headless UI primitives
- **TailwindCSS**: Utility-first styling
- **Lucide React**: Icon library

## Future Integrations (Prepared)
- **SumSub**: KYC/AML verification service
- **Tink/Neonomics**: PSD2 banking integration
- **Solarisbank/Railsr**: Banking-as-a-Service providers

# Deployment Strategy

## Development Environment
- Vite dev server for fast frontend development
- Hot module replacement and error overlay
- TypeScript compilation with strict mode
- Environment variables through Replit secrets

## Production Build
- Frontend built to static assets via Vite
- Backend bundled with esbuild for Node.js deployment
- Single-server deployment with Express serving both API and static files
- Database migrations applied via `npm run db:push`

## Environment Configuration
- Database connection via `DATABASE_URL` environment variable
- Session secrets and API keys stored securely
- Replit-specific configurations for domains and OIDC
- Production/development environment switching

## Security Considerations
- All sensitive data stored in environment variables
- Rate limiting to prevent abuse
- Secure session handling with HttpOnly cookies
- CSRF protection on state-changing operations
- Input validation on all API endpoints