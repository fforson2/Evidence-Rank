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
  title: "EvidenceRank",
  description: "Research prototype comparing an engagement feed with an evidence-aware feed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background font-sans text-foreground">
        <header className="sticky top-0 z-20 border-b border-line bg-background/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 py-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">
              ER
            </span>
            <div>
              <p className="text-base font-semibold leading-tight tracking-tight">EvidenceRank</p>
              <p className="text-xs text-muted">Research prototype</p>
            </div>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
