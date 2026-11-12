// Pure static SPA: no server rendering at all, so no browser global can ever be touched
// during SSR, and every route works on a direct URL and a hard refresh via the 200.html
// fallback.
export const prerender = false;
export const ssr = false;
export const trailingSlash = 'always';
