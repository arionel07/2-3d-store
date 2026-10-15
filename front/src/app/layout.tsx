import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Store Layout Planner",
  description: "A fast visual planning tool for Vizaje-Nica stores.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <html lang="en"><body>{children}</body></html>;
}
