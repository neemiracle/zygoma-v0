import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Auth0Provider } from "@auth0/nextjs-auth0"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Next.js Auth0 Monorepo",
  description: "Production-ready monorepo with Auth0 authentication",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Auth0Provider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
          </ThemeProvider>
        </Auth0Provider>
      </body>
    </html>
  )
}
