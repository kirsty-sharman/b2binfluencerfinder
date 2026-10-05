import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creator Evidence",
  description: "Find experts who make brand content more credible.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
