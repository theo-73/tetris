import type { Metadata } from "next";
import { Orbitron, Share_Tech_Mono } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const shareTechMono = Share_Tech_Mono({
  weight: "400",
  variable: "--font-share-tech",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Entropic Tetris // Adversarial Neural Matrix",
  description: "Adversarial Tetris driven by a predictive heuristic AI engine with real-time entropy targeting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${orbitron.variable} ${shareTechMono.variable} h-full antialiased selection:bg-cyan-500/30`}
    >
      <body className="min-h-full flex flex-col bg-black text-white font-share-tech">{children}</body>
    </html>
  );
}
