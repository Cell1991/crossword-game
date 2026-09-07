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
  icons: {
    icon: "/wordx-icon.png",
    shortcut: "/wordx-icon.png",
    apple: "/wordx-icon.png",
  },
  openGraph: {
    title: "WordX – Multiplayer Crossword Game",
    description: "Place words, score points, beat your friends in this real-time multiplayer crossword game!",
    images: ["/wordx-icon.png"],
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
