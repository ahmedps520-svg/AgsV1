import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-static";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.productName} — ${BRAND.name}`,
    short_name: `${BRAND.shortName} Dismissal`,
    description:
      "Tap when you arrive, watch your student move through the queue, and know the moment they're ready.",
    id: `${basePath}/parent/`,
    start_url: `${basePath}/parent/`,
    scope: `${basePath}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f9fb",
    theme_color: "#1E3A73",
    categories: ["education", "productivity"],
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: `${basePath}/icons/maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "I'm Here", short_name: "I'm Here", url: `${basePath}/parent/?action=arrive` },
      { name: "Dismissal board", short_name: "Board", url: `${basePath}/board/` },
    ],
  };
}
