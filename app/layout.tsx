import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FastLead AI",
  description: "Local business finder powered by Google Places",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
