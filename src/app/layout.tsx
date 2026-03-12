import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Nav } from "@/components/shared/nav";
import { ClaimsStrip } from "@/components/shared/claims-strip";
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
  title: "Competitive War Room",
  description: "Competitive intelligence dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-50`}>
        <Providers>
          <Nav />
          <ClaimsStrip />
          <main className="mx-auto max-w-[1400px] px-4 sm:px-6 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
