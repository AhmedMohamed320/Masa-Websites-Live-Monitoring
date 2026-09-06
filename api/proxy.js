export default async function handler(req, res) {
  // Support both query param in req.url and req.query
  const urlObj = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const targetUrl = urlObj.searchParams.get('url') || (req.query && req.query.url);

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Missing url parameter');
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8'
      },
      redirect: 'follow'
    });

    const contentType = response.headers.get('content-type') || 'text/html; charset=utf-8';

    if (!response.ok && response.status !== 200) {
      res.statusCode = response.status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.end(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
          <head><meta charset="utf-8"></head>
          <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#94a3b8;">
            <div style="text-align:center;padding:20px;">
              <h3 style="color:#f43f5e;margin-bottom:8px;">حماية الخادم الخارجي (HTTP ${response.status})</h3>
              <p style="font-size:14px;max-width:320px;line-height:1.5;">الموقع محمي بواسطة Cloudflare أو جدار ناري خارجي يمنع التضمين.</p>
              <a href="${targetUrl}" target="_blank" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;">فتح الموقع مباشرة ↗</a>
            </div>
          </body>
        </html>
      `);
    }

    let html = await response.text();

    // Inject <base href="..."> and interceptor so relative assets and /api calls resolve to target domain
    const targetOrigin = new URL(targetUrl).origin;
    const injection = `
      <base href="${targetUrl}">
      <script>
        (function() {
          try {
            var origin = "${targetOrigin}";
            var origFetch = window.fetch;
            if (origFetch) {
              window.fetch = function(input, init) {
                if (typeof input === 'string' && input.startsWith('/')) {
                  input = origin + input;
                }
                return origFetch.call(this, input, init);
              };
            }
            var origOpen = XMLHttpRequest.prototype.open;
            XMLHttpRequest.prototype.open = function(method, url) {
              if (typeof url === 'string' && url.startsWith('/')) {
                arguments[1] = origin + url;
              }
              return origOpen.apply(this, arguments);
            };
          } catch(e) {}
        })();
      </script>
    `;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${injection}`);
    } else if (html.includes('<HEAD>')) {
      html = html.replace('<HEAD>', `<HEAD>${injection}`);
    } else {
      html = injection + html;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    // Notice: X-Frame-Options and restrictive CSP are completely omitted!
    return res.end(html);
  } catch (err) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
        <head><meta charset="utf-8"></head>
        <body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0f172a;color:#94a3b8;">
          <div style="text-align:center;padding:20px;">
            <h3 style="color:#f43f5e;margin-bottom:8px;">تعذر الاتصال بالموقع</h3>
            <p style="font-size:14px;max-width:320px;line-height:1.5;">${err.message}</p>
            <a href="${targetUrl}" target="_blank" style="display:inline-block;margin-top:12px;padding:8px 16px;background:#6366f1;color:#fff;border-radius:6px;text-decoration:none;font-size:13px;font-weight:bold;">فتح الموقع مباشرة ↗</a>
          </div>
        </body>
      </html>
    `);
  }
}
