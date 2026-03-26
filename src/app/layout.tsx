import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/ThemeProvider";
import { ErrorBoundaryProvider } from "@/components/ErrorBoundaryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CitySleeps — The Social Deduction Game",
  description:
    "A competitive social deduction game. One device moderates, everyone plays on their phones.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#05050a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ErrorBoundaryProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundaryProvider>
      </body>
    </html>
  );
}
