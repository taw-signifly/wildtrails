import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "WildTrails",
    template: "%s | WildTrails"
  },
  description: "Professional Petanque tournament management system. Create, manage, and track tournaments with real-time scoring and bracket management.",
  keywords: ["petanque", "tournament", "management", "scoring", "brackets", "sports"],
  authors: [{ name: "WildTrails" }],
  creator: "WildTrails",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wildtrails.vercel.app",
    siteName: "WildTrails",
    title: "WildTrails - Petanque Tournament Management",
    description: "Professional Petanque tournament management system with real-time scoring and bracket management.",
  },
  twitter: {
    card: "summary_large_image",
    title: "WildTrails - Petanque Tournament Management",
    description: "Professional Petanque tournament management system with real-time scoring and bracket management.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
