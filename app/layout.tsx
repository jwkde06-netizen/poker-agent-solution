import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "포커 에이전트 통합 정산",
  description: "플레이어, 에이전트 코드, 레이크백, 일일 및 주간 정산 관리",
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
