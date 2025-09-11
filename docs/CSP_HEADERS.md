# Production CSP Headers

To enforce Content Security Policy (including `frame-ancestors`), set CSP via HTTP response headers at your hosting layer. The meta tag in `index.html` is helpful in dev but cannot enforce `frame-ancestors`.

Example (Netlify `_headers` file):

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; worker-src 'self' blob:; media-src 'self' https: data:; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
```

Example (Vercel `vercel.json`):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; worker-src 'self' blob:; media-src 'self' https: data:; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
        }
      ]
    }
  ]
}
```

Example (Nginx):

```
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: blob: https:; font-src 'self' https: data:; connect-src 'self' https: wss:; worker-src 'self' blob:; media-src 'self' https: data:; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'" always;
```

Notes:

- Adjust `connect-src` to include your Supabase URL.
- If you load remote images or fonts, add their origins to `img-src`/`font-src`.
- Avoid `'unsafe-eval'` if you do not need it; Vite dev may require it, production often does not. Test and remove if possible.
- For iFrames you want to allow, add their origins to `frame-ancestors`.
