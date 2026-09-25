import type { Metadata } from "next";
import type { ReactNode } from "react";
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
  title: "WordX – Multiplayer Crossword Game",
  description: "Place words, score points, beat your friends in this real-time multiplayer crossword game!",
  // Tab and home-screen icons use a 256px copy: the full logo is 1.9 MB and browsers
  // fetched all of it just to draw a 16–32px favicon.
  icons: {
    icon: "/wordx-icon-256.png?v=20260915",
    shortcut: "/wordx-icon-256.png?v=20260915",
    apple: "/wordx-icon-256.png?v=20260915",
  },
  openGraph: {
    title: "WordX – Multiplayer Crossword Game",
    description: "Place words, score points, beat your friends in this real-time multiplayer crossword game!",
    images: ["/wordx-icon.png?v=20260915"],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
