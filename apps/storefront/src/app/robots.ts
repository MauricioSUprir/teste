import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/checkout", "/conta"],
    },
    sitemap: "https://beautynow.com.br/sitemap.xml",
  };
}
