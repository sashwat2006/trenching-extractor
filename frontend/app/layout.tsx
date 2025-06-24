import type { Metadata } from 'next'
import './globals.css'
import MsalProviderWrapper from '@/components/auth/MsalProviderWrapper'

export const metadata: Metadata = {
  title: 'v0 App',
  description: 'Created with v0',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="bg-[#181e29]">
      <body className="bg-[#181e29] text-white font-inter">
        <MsalProviderWrapper>{children}</MsalProviderWrapper>
      </body>
    </html>
  )
}
