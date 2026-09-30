// Avoid Astro's getStaticPaths cache for CMS-created pages in local development.
// Production/staging builds remain fully prerendered static output.
export default function cmsDevPages({ liveArticles = false } = {}) {
  let development = false;
  return {
    name: 'cms-dev-pages',
    hooks: {
      'astro:config:setup': ({ command }) => { development = command === 'dev'; },
      'astro:route:setup': ({ route }) => {
        if (development && route.component === 'src/pages/[...page].astro') route.prerender = false;
        if (development && liveArticles && /^src\/pages\/(baccarat|strategy|guide|tips|comparison)\/\[slug\]\.astro$/.test(route.component)) route.prerender = false;
      },
    },
  };
}
