import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const granix = localFont({
  src: "../public/fonts/Granix-Demo.otf",
  variable: "--font-granix",
  display: "swap",
});

const interBlackItalic = localFont({
  src: "../public/fonts/inter.18pt-black-italic.ttf",
  variable: "--font-inter-black-italic",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://wordx-game.com"),
  title: "WordX - Real-time Multiplayer Crossword Game",
  description: "Place words, score points, and battle opponents in this infinite dynamic real-time crossword arena!",
  keywords: ["word game", "crossword", "multiplayer", "real-time", "scrabble", "board game"],
  authors: [{ name: "WordX Team" }],
  icons: {
    icon: "/wordx-icon-256.png?v=20260915",
    shortcut: "/wordx-icon-256.png?v=20260915",
    apple: "/wordx-icon-256.png?v=20260915",
  },
  openGraph: {
    title: "WordX - Real-time Multiplayer Crossword Game",
    description: "Place words, score points, and battle opponents in this infinite dynamic real-time crossword arena!",
    images: ["/wordx-icon-256.png?v=20260915"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WordX - Real-time Multiplayer Crossword Game",
    description: "Place words, score points, and battle opponents in this infinite dynamic real-time crossword arena!",
    images: ["/wordx-icon-256.png?v=20260915"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

import BackgroundMusic from "@/components/audio/BackgroundMusic";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${granix.variable} ${interBlackItalic.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <BackgroundMusic />
      </body>
    </html>
  );
}

