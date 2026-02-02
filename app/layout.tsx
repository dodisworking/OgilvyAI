import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Production Department Management",
  description: "Organizational system for production department",
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