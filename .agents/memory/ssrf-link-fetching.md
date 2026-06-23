---
name: SSRF guard for user-supplied link fetching
description: Any server-side fetch of a URL the user/contributor supplied must pass the SSRF guard before fetching.
---

# Rule
Any time the server fetches a URL that originated from user/contributor input (e.g. a submitted link to extract/rate), it MUST: validate scheme is http/https, restrict to ports 80/443, resolve the host and reject any private/loopback/link-local/CGNAT/multicast/reserved address (IPv4 + IPv6, incl. `::ffff:` mapped), follow redirects **manually** re-validating each hop, apply an AbortController timeout, cap the response bytes, and allowlist text-ish content-types.

**Why:** An unrestricted `fetch(userUrl, {redirect:"follow"})` is a server-side request forgery hole — a submitted link can probe `localhost`, RFC1918 hosts, or `169.254.169.254` cloud metadata. Caught in code review of the academic-contribution parse/rate feature.

**How to apply:** Reuse the `assertPublicUrl` / `isPrivateIp` / `readCapped` helpers in `server/routes.ts`. Never reintroduce a plain `fetch` with `redirect:"follow"` on a user-controlled URL. Note: this resolve-then-fetch approach does not fully close DNS-rebinding (re-resolution between check and connect); acceptable for this surface but pin the IP if a stronger guarantee is ever needed.
