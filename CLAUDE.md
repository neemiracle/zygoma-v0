# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a Next.js application using pnpm for package management:

- `pnpm dev` - Start development server on localhost:3000
- `pnpm build` - Build for production
- `pnpm lint` - Run ESLint checks
- `pnpm start` - Start production server

The project also supports Turbo commands defined in turbo.json:
- `pnpm type-check` - Run TypeScript type checking

## Architecture

This is a Next.js 15 App Router application with Auth0 authentication and shadcn/ui components. Despite being called a "monorepo" in the README, the current structure is a single Next.js app without separate packages.

### Key Structure:
- **Authentication**: Auth0 integration via `@auth0/nextjs-auth0`
  - Auth routes: `/api/auth/[...auth0]/route.ts` 
  - UserProvider wraps the app in `app/layout.tsx`
  - Login redirects to `/dashboard`, logout to `/`
- **UI**: Complete shadcn/ui component library in `components/ui/`
- **Styling**: Tailwind CSS with dark/light theme support via `next-themes`
- **Components**: Custom components in `components/` including theme toggle and dashboard content

### Auth Flow:
- Public: `/` (landing page)
- Protected: `/dashboard` 
- Auth endpoints: `/api/auth/login`, `/api/auth/logout`, `/api/auth/callback`

## Environment Setup

Requires `.env.local` with Auth0 configuration:
- `AUTH0_SECRET` - Generate with `openssl rand -hex 32`
- `AUTH0_ISSUER_BASE_URL` - Auth0 domain
- `AUTH0_CLIENT_ID` - Auth0 client ID  
- `AUTH0_CLIENT_SECRET` - Auth0 client secret

## Development Notes

- Uses App Router (not Pages Router)
- TypeScript configured with strict settings
- shadcn/ui components can be added with: `pnpm dlx shadcn@latest add [component-name]`
- Theme switching implemented with `next-themes` and custom toggle component