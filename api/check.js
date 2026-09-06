export default async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
  const targetUrl = urlObj.searchParams.get('url') || (req.query && req.query.url);

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Missing url parameter' }));
  }

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow',
      signal: controller.signal
    });
    clearTimeout(timeout);

    const latency = Math.round(performance.now() - start);
    const xfo = response.headers.get('x-frame-options');
    const csp = response.headers.get('content-security-policy') || '';
    const blocksIframe = !!xfo || csp.includes('frame-ancestors');

    let bodySample = '';
    let isBlankPage = false;
    let isCloudflareBlocked = false;
    let isServerErrorPage = false;

    try {
      const text = await response.text();
      bodySample = text.slice(0, 4000).toLowerCase();

      // Check if Cloudflare challenge/turnstile
      if (bodySample.includes('cf-browser-verification') || bodySample.includes('just a moment...') || bodySample.includes('challenge-platform')) {
        isCloudflareBlocked = true;
      }

      // Check for server error in HTML title or body
      if (bodySample.includes('<title>500') || bodySample.includes('<title>502') || bodySample.includes('internal server error') || bodySample.includes('database error')) {
        isServerErrorPage = true;
      }

      // Check if completely blank white page (under 100 chars and no real body elements)
      const cleanText = text.replace(/\s+/g, '');
      if (cleanText.length < 80 || (cleanText.includes('<div id="__nuxt"></div>') && cleanText.length < 200)) {
        isBlankPage = true;
      }
    } catch (e) {
      // Stream reading error
    }

    const isReallyOk = response.status >= 200 && response.status < 400 && !isServerErrorPage && !isBlankPage;

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(JSON.stringify({
      ok: isReallyOk,
      statusCode: response.status,
      latency,
      blocksIframe,
      xFrameOptions: xfo,
      statusText: response.statusText,
      finalUrl: response.url || targetUrl,
      isBlankPage,
      isCloudflareBlocked,
      isServerErrorPage
    }));
  } catch (err) {
    const latency = Math.round(performance.now() - start);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.end(JSON.stringify({
      ok: false,
      statusCode: 0,
      latency,
      blocksIframe: false,
      error: err.message
    }));
  }
}
