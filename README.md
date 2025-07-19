# Next.js Auth0 Monorepo

A production-ready monorepo setup with Next.js, Auth0 authentication, and shadcn/ui components.

## 🚀 Quick Start

### 1. Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### 2. Set up Auth0

1. Create an Auth0 account at [auth0.com](https://auth0.com)
2. Create a new application (Regular Web Application)
3. Configure the following settings in your Auth0 dashboard:
   - **Allowed Callback URLs**: `http://localhost:3000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`

### 3. Environment Configuration

Copy `.env.local.example` to `.env.local` and fill in your Auth0 credentials:

\`\`\`bash
cp .env.local.example .env.local
\`\`\`

Update the following variables:
- `AUTH0_SECRET`: Generate with `openssl rand -hex 32`
- `AUTH0_ISSUER_BASE_URL`: Your Auth0 domain
- `AUTH0_CLIENT_ID`: Your Auth0 client ID
- `AUTH0_CLIENT_SECRET`: Your Auth0 client secret

### 4. Run Development Server

\`\`\`bash
pnpm dev
\`\`\`

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

\`\`\`
├── apps/
│   └── web/                    # Next.js application
│       ├── app/               # App Router pages
│       ├── components/        # React components
│       └── lib/              # Utilities
├── packages/
│   └── ui/                    # Shared UI components
├── .env.local                 # Environment variables
├── turbo.json                # Turbo configuration
└── pnpm-workspace.yaml       # pnpm workspace config
\`\`\`

## 🔐 Authentication Flow

- **Public Routes**: Landing page (`/`)
- **Protected Routes**: Dashboard (`/dashboard`)
- **Auth Routes**: 
  - Login: `/api/auth/login`
  - Logout: `/api/auth/logout`
  - Callback: `/api/auth/callback`

## 🎨 UI Components

This project includes all shadcn/ui components:
- Button, Card, Dialog, DropdownMenu
- Input, Tabs, Toggle, Badge
- Avatar, Progress, Separator
- And many more...

## 🛠️ Technologies

- **Framework**: Next.js 14 (App Router)
- **Authentication**: Auth0
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **Package Manager**: pnpm
- **Monorepo**: Turborepo
- **Language**: TypeScript

## 📦 Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint
- `pnpm type-check` - Run TypeScript checks

## 🚀 Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy!

### Other Platforms

Make sure to set the correct environment variables and build commands for your platform.

## 🔧 Customization

### Adding New Components

\`\`\`bash
pnpm dlx shadcn@latest add [component-name]
\`\`\`

### Theming

Modify `app/globals.css` to customize the color scheme and themes.

### Auth0 Configuration

Update `app/api/auth/[...auth0]/route.ts` to customize authentication behavior.

## 📝 License

MIT License - see LICENSE file for details.
