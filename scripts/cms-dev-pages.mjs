// Avoid Astro's getStaticPaths cache for CMS-created pages in local development.
// Production/staging builds remain fully prerendered static output.
export default function cmsDevPages() {
  let development = false;
  return {
    name: 'cms-dev-pages',
    hooks: {
      'astro:config:setup': ({ command }) => { development = command === 'dev'; },
      'astro:route:setup': ({ route }) => {
        if (development && route.component === 'src/pages/[...page].astro') route.prerender = false;
      },
    },
  };
}
