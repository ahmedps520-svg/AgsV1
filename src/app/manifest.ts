import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Map Dismissals",
    short_name: "Dismissals",
    description:
      "Tap when you arrive, watch your student move through the queue, and know the moment they're ready.",
    id: "/parent",
    start_url: "/parent",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f8fa",
    theme_color: "#5b4bdb",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "I'm Here", short_name: "I'm Here", url: "/parent?action=arrive" },
      { name: "Dismissal board", short_name: "Board", url: "/board" },
    ],
  };
}
