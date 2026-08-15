/**
 * Cloudflare Worker: Pages Service Binding & Reverse Proxy Gateway
 * 
 * Setup in Cloudflare Dashboard:
 * 1. Deploy your frontend to Cloudflare Pages (e.g. project name: "video-app")
 * 2. In your Worker Settings -> Variables -> Service Bindings:
 *    - Variable name: PAGES
 *    - Service: <your-pages-project-name>
 *    - Environment: Production
 * 
 * 3. In your Worker Environment Variables:
 *    - RENDER_BACKEND_URL = https://your-app.onrender.com (optional: Worker can proxy /api/ directly)
 *    - ACCESS_KEY = your-secret-token (optional: restrict unauthorized access)
 */

export interface Env {
  // Cloudflare Pages Service Binding
  PAGES: Fetcher;
  // Render Backend URL (e.g. https://my-backend.onrender.com)
  RENDER_BACKEND_URL?: string;
  // Shared Secret Key (if you want to lock the app completely)
  ACCESS_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 1. Check if Pages service binding is configured
    if (!env.PAGES) {
      return new Response(
        JSON.stringify({
          error: "Cloudflare Pages Service Binding 'PAGES' is not configured in Worker settings.",
          instructions: "Go to Worker -> Settings -> Variables -> Service Bindings -> Add 'PAGES' bound to your Pages project."
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Optional: Access Key Gate (If set, only requests with ?key=... or cookie can enter)
    if (env.ACCESS_KEY) {
      const urlKey = url.searchParams.get("key");
      const cookieHeader = request.headers.get("Cookie") || "";
      const hasAuthCookie = cookieHeader.includes(`cf_auth=${env.ACCESS_KEY}`);

      if (urlKey === env.ACCESS_KEY) {
        // Set cookie and redirect without key in URL
        url.searchParams.delete("key");
        const headers = new Headers();
        headers.set("Set-Cookie", `cf_auth=${env.ACCESS_KEY}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
        headers.set("Location", url.pathname + url.search);
        return new Response(null, { status: 302, headers });
      }

      if (!hasAuthCookie) {
        return new Response("Access Denied: Private Application", { status: 403 });
      }
    }

    // 3. API Proxy to Render Backend (Eliminates CORS & keeps Render URL completely hidden)
    if (url.pathname.startsWith("/api/")) {
      const renderBase = (env.RENDER_BACKEND_URL || "").replace(/\/+$/, "");
      if (renderBase) {
        const targetUrl = new URL(url.pathname + url.search, renderBase);
        
        // Clone request headers, rewriting host
        const proxyHeaders = new Headers(request.headers);
        proxyHeaders.set("Host", new URL(renderBase).hostname);
        proxyHeaders.set("X-Forwarded-For", request.headers.get("CF-Connecting-IP") || "");

        const apiResponse = await fetch(targetUrl.toString(), {
          method: request.method,
          headers: proxyHeaders,
          body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
          redirect: "follow",
        });

        // Return API response with permissive CORS for worker context
        const responseHeaders = new Headers(apiResponse.headers);
        responseHeaders.set("Access-Control-Allow-Origin", "*");
        responseHeaders.set("Access-Control-Allow-Headers", "*");
        
        return new Response(apiResponse.body, {
          status: apiResponse.status,
          statusText: apiResponse.statusText,
          headers: responseHeaders,
        });
      }
    }

    // 4. Forward all other traffic directly to your bound Cloudflare Pages instance
    // This allows the Worker to serve your Pages project directly via service binding
    return env.PAGES.fetch(request);
  },
};
