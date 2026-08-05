/**
 * Every documented way to tell Pinterest's browser extension not to offer a
 * save button on an image.
 *
 * Pinterest checks three things and any one of them suppresses the overlay:
 *   - a site-wide `<meta name="pinterest" content="nopin">` (set in layout.tsx)
 *   - a `nopin` attribute on the image
 *   - `data-pin-nopin="true"` on the image
 *
 * All three are used because the meta tag alone was not enough in practice.
 *
 * Worth being straight about the limit: a web page cannot block a browser
 * extension. Extensions run with more privilege than page scripts and can
 * ignore any of this. These are the opt-outs Pinterest publishes and honours —
 * if a button is still showing, it is either configured to override the site's
 * request, or it belongs to a different extension entirely.
 */
export const NOPIN = {
  nopin: "nopin",
  "data-pin-nopin": "true",
} as Record<string, string>;
