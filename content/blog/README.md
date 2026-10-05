# Blog publishing

Each article is one JSON file in this folder. Copy an existing article as the template. No database migration or separate CMS is required.

- Use a unique, permanent `slug` matching the filename. The URL is `/blog/<slug>`.
- Fill in title, description, social title/description, category, author and dates.
- Add approved copy to `blocks`: `p`, `h2`, `quote`, or `li`. A paragraph can include `sources` with a descriptive label and HTTPS URL.
- Put optimized hero and diagram images in `public/blog`; provide descriptive alt text. Set `diagramAfter` to an exact section heading.
- Keep `status: "draft"` and `publishedAt: null` while reviewing. Drafts are visible in local development and with `BLOG_PREVIEW=true`; draft pages are noindex and excluded from the sitemap. Do not enable BLOG_PREVIEW on production.
- When approved for publication, set `status: "published"`, set the actual `publishedAt` date (YYYY-MM-DD), update `updatedAt`, then deploy. The index, related reading and sitemap update automatically.
- Confirm authorship before publication. The initial four posts use the organization byline pending editorial confirmation.

The index renders all article links in HTML for discoverability, with client-side search and lazy-loaded images. This supports the planned library of 50+ posts without sending article bodies to the index client.

Run `npm run typecheck`, `npm run lint`, and `npm run build` before deployment. Review article layout and sources. Generated diagrams can be recreated with `node scripts/build-blog-visuals.mjs` (uses the sharp dependency shipped with Next).

## Automatic sitemap and llms.txt

Every production build generates `/sitemap.xml` and `/llms.txt` from current public page files and published blog JSON. Add or delete a public `app/**/page.tsx` or published article, then deploy: both outputs update together. Draft articles, authentication routes and `/app` are excluded. Put an empty `sitemap.exclude` file in a route folder to exclude that subtree (also set noindex metadata on pages you do not want indexed). Route groups are supported. Other dynamic routes need their own data-backed URL enumeration; bracket placeholders are never included. There is no crawler cron or manual sitemap editing. Local file changes are not live until deployed. llms.txt is an informational index, not access control or a guarantee of AI indexing.
