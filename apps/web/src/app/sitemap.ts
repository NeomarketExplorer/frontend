import type { MetadataRoute } from 'next';

const BASE_URL = 'https://neomarket.bet';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const INDEXER_URL = process.env.INDEXER_URL;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/events`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/markets`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
    { url: `${BASE_URL}/opportunities`, lastModified: new Date(), changeFrequency: 'hourly', priority: 0.8 },
    { url: `${BASE_URL}/portfolio`, changeFrequency: 'daily', priority: 0.5 },
  ];

  // Dynamic: fetch events and markets from indexer
  try {
    const [eventsRes, marketsRes] = await Promise.allSettled([
      fetch(`${INDEXER_URL}/events?limit=500&active=true`).then(r => r.json()),
      fetch(`${INDEXER_URL}/markets?limit=500&active=true`).then(r => r.json()),
    ]);

    const eventPages: MetadataRoute.Sitemap = [];
    const marketPages: MetadataRoute.Sitemap = [];

    if (eventsRes.status === 'fulfilled' && eventsRes.value?.data) {
      for (const event of eventsRes.value.data) {
        eventPages.push({
          url: `${BASE_URL}/events/${event.id}`,
          lastModified: event.updatedAt ? new Date(event.updatedAt) : new Date(),
          changeFrequency: 'daily',
          priority: 0.7,
        });
      }
    }

    if (marketsRes.status === 'fulfilled' && marketsRes.value?.data) {
      for (const market of marketsRes.value.data) {
        marketPages.push({
          url: `${BASE_URL}/market/${market.id}`,
          lastModified: market.updatedAt ? new Date(market.updatedAt) : new Date(),
          changeFrequency: 'hourly',
          priority: 0.8,
        });
      }
    }

    return [...staticPages, ...eventPages, ...marketPages];
  } catch {
    return staticPages;
  }
}
