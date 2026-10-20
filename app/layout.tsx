import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

export const metadata: Metadata = { title: "Susu Savings", description: "Group savings tracker", icons: { icon: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#0F1626", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Toaster>{children}</Toaster>
      </body>
    </html>
  );
}
