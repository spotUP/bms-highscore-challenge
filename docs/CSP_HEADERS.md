# Security Headers Configuration

This document provides ready-to-use security header configurations for different hosting platforms. These headers help protect your application from common web vulnerabilities.

## Vercel

Create or update `vercel.json` in your project root:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; media-src 'self' https: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        },
        {
          "key": "Strict-Transport-Security",
          "value": "max-age=63072000; includeSubDomains; preload"
        }
      ]
    }
  ]
}
```

## Netlify

Create or update `netlify.toml` in your project root:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(), microphone=(), geolocation=()"
    Content-Security-Policy = """
      default-src 'self';
      script-src 'self' 'unsafe-inline' 'unsafe-eval' https:;
      style-src 'self' 'unsafe-inline' https:;
      img-src 'self' data: blob: https:;
      font-src 'self' https: data:;
      connect-src 'self' https: wss:;
      media-src 'self' https: data:;
      object-src 'none';
      frame-ancestors 'none';
      base-uri 'self';
      form-action 'self';
    """
    Strict-Transport-Security = "max-age=63072000; includeSubDomains; preload"
```

## Nginx

Add to your server configuration:

```nginx
add_header X-Content-Type-Options          "nosniff" always;
add_header X-Frame-Options                "DENY" always;
add_header X-XSS-Protection               "1; mode=block" always;
add_header Referrer-Policy                "strict-origin-when-cross-origin" always;
add_header Permissions-Policy             "camera=(), microphone=(), geolocation=()" always;
add_header Strict-Transport-Security      "max-age=63072000; includeSubDomains; preload" always;
add_header Content-Security-Policy        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; media-src 'self' https: data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" always;
```

## Customization Notes

1. **Content Security Policy (CSP)**:
   - Add domains to `connect-src` if you use external APIs
   - Add domains to `img-src` for external images
   - Add domains to `font-src` for external fonts
   - Adjust `script-src` and `style-src` policies based on your needs

2. **Frame Options**:
   - Set to `DENY` to prevent all framing
   - Use `SAMEORIGIN` to allow framing by the same site
   - Or specify allowed origins: `frame-ancestors 'self' example.com`

3. **Feature Policy**:
   - Enable only the browser features your app needs
   - Example: `geolocation=(self 'https://maps.example.com')`

4. **Testing**:
   - Use browser developer tools to check for CSP violations
   - Test in staging before production
   - Consider using `Content-Security-Policy-Report-Only` initially

## Verification

After deployment, verify headers are set correctly using:

```bash
curl -I https://your-site.com/
```

Or use online tools like:
- [Security Headers](https://securityheaders.com/)
- [Mozilla Observatory](https://observatory.mozilla.org/)
