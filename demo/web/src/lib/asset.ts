/**
 * Base-aware public asset URL. In dev BASE_URL is '/', on a GitHub project page
 * it is '/<repo>/'. Using this keeps /paper/*.png and the favicon correct
 * whether the site is served from a domain root or a repo sub-path.
 */
export const asset = (p: string) =>
  import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + p.replace(/^\//, '')
