import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
export const metadata: Metadata = {
  title: "PracticeChart EHR",
  description: "A fictional private practice EHR for the CIT4001 course.",
  robots: { index: false, follow: false },
  applicationName: "PracticeChart EHR",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#163e36",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className={geist.variable}>{children}</body>
    </html>
  );
}
