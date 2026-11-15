import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ledger — Inventory Management",
    short_name: "Ledger",
    description: "Stock ledger, purchase/sales orders, and barcode scanning for inventory management.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#14171f",
    theme_color: "#14171f",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
