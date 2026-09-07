import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Dismissal board" };

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14131f",
};

export default function BoardLayout({ children }: { children: React.ReactNode }) {
  return <div id="main">{children}</div>;
}
