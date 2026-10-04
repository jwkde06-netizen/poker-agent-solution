import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poker Agent Settlement",
  description: "Dynamic poker agent rakeback settlement dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
