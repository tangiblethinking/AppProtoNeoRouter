const UPSTREAM = "https://ats-x.vercel.app";

/** Paths that must stay under /job so the browser requests them through this proxy. */
const ROOT_ASSET_PREFIXES = ["/assets/", "/__grok/", "/favicon.svg", "/favicon.ico"];

function upstreamPath(reqUrl) {
  const u = new URL(reqUrl);
  // /api/job-proxy  or  /api/job-proxy?path=assets/foo.js  or rewrite injects path
  const pathParam = u.searchParams.get("path");
  if (pathParam != null && pathParam !== "") {
    // Vercel may pass path as "assets/foo" or "assets/foo/bar"
    const joined = pathParam.startsWith("/") ? pathParam : `/${pathParam}`;
    return joined;
  }
  // Direct hits via /job rewrite without path query → upstream root
  return "/";
}

function rewriteHtml(html) {
  let out = html;
  // Root-relative asset URLs → under /job so they hit this proxy
  out = out.replace(/(href|src)=(["'])\/(assets\/)/g, "$1=$2/job/$3");
  out = out.replace(/(href|src)=(["'])\/(__grok\/)/g, "$1=$2/job/$3");
  out = out.replace(/(href|src)=(["'])\/(favicon\.svg)/g, "$1=$2/job/$3");
  out = out.replace(/(href|src)=(["'])\/(favicon\.ico)/g, "$1=$2/job/$3");
  // modulepreload / link href in serialized router payloads
  out = out.replace(/("|")\/assets\//g, "$1/job/assets/");
  out = out.replace(/preloads:\["\/assets\//g, 'preloads:["/job/assets/');
  out = out.replace(/src:\"\/assets\//g, 'src:"/job/assets/');
  return out;
}

function shouldRewriteBody(contentType) {
  if (!contentType) return false;
  return (
    contentType.includes("text/html") ||
    contentType.includes("application/javascript") ||
    contentType.includes("text/javascript") ||
    contentType.includes("application/json")
  );
}

export default async function handler(req, res) {
  try {
    const path = upstreamPath(req.url);
    const target = new URL(path, UPSTREAM);

    // Forward query string except our internal path param
    const incoming = new URL(req.url, "http://localhost");
    incoming.searchParams.delete("path");
    for (const [k, v] of incoming.searchParams) {
      target.searchParams.set(k, v);
    }

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      const lower = key.toLowerCase();
      if (
        lower === "host" ||
        lower === "connection" ||
        lower === "content-length" ||
        lower === "transfer-encoding"
      ) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) headers.append(key, v);
      } else {
        headers.set(key, value);
      }
    }

    const method = req.method || "GET";
    const init = { method, headers, redirect: "manual" };

    if (method !== "GET" && method !== "HEAD") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      init.body = Buffer.concat(chunks);
    }

    const upstreamRes = await fetch(target.toString(), init);

    // Pass through status and most headers
    res.statusCode = upstreamRes.status;
    upstreamRes.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (
        lower === "transfer-encoding" ||
        lower === "content-encoding" ||
        lower === "content-length"
      ) {
        return;
      }
      // Avoid leaking upstream location to ats-x host for relative redirects
      if (lower === "location") {
        try {
          const loc = new URL(value, UPSTREAM);
          if (loc.origin === new URL(UPSTREAM).origin) {
            const mapped = `/job${loc.pathname === "/" ? "" : loc.pathname}${loc.search}`;
            res.setHeader("location", mapped);
            return;
          }
        } catch {
          /* keep original */
        }
      }
      res.setHeader(key, value);
    });

    const ct = upstreamRes.headers.get("content-type") || "";

    if (method === "HEAD") {
      res.end();
      return;
    }

    const buf = Buffer.from(await upstreamRes.arrayBuffer());

    if (shouldRewriteBody(ct) && buf.length > 0) {
      const text = buf.toString("utf8");
      // Only rewrite HTML (and JS that embeds absolute asset paths from the app)
      if (ct.includes("text/html") || text.includes("/assets/")) {
        const rewritten = rewriteHtml(text);
        res.setHeader("content-type", ct.includes("text/html") ? "text/html; charset=utf-8" : ct);
        res.end(rewritten);
        return;
      }
    }

    res.end(buf);
  } catch (err) {
    console.error("[job-proxy]", err);
    res.statusCode = 502;
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.end("Bad gateway proxying ATS-X");
  }
}
