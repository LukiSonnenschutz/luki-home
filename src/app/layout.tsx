import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Luki Home · Dein Tag",
  description: "Fokus, Stabilität und ein bewusster Abschluss.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
