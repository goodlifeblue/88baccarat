# Railway's Directus service uses this root Dockerfile. The detailed source is
# also retained at deploy/railway/Dockerfile.directus for deployment reference.
FROM directus/directus:11.17.3

USER root
COPY directus/hooks/redirects /directus/extensions/directus-extension-article-redirects
COPY directus/extensions/directus-extension-carousel-image-preview /directus/extensions/directus-extension-carousel-image-preview
COPY directus/extensions/directus-extension-password-preview /directus/extensions/directus-extension-password-preview
COPY directus/extensions/directus-extension-markdown-media /directus/extensions/directus-extension-markdown-media
COPY deploy/railway/directus-entrypoint.sh /usr/local/bin/railway-directus-entrypoint.sh
RUN chmod 755 /usr/local/bin/railway-directus-entrypoint.sh \
  && chown -R node:node /directus/extensions

USER root
ENTRYPOINT ["/usr/local/bin/railway-directus-entrypoint.sh"]
CMD ["/bin/sh", "-c", ": && node cli.js bootstrap && pm2-runtime start ecosystem.config.cjs"]
