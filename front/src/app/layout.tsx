import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Планировщик магазинов",
  description: "Инструмент планирования магазинов Vizaje-Nica.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="ru"><body className={`${GeistSans.variable} ${GeistMono.variable}`}>{children}</body></html>;
}
