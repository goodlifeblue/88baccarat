import { getSite } from '../data/site';
export async function GET() {
  const site = await getSite();
  const body = import.meta.env.APP_ENV === 'production'
    ? `User-agent: *\nAllow: /\n\nSitemap: ${site.url.replace(/\/$/, '')}/sitemap-index.xml\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
