import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { request as httpRequest } from "node:http";

export async function startTlsProxy({ certificatePath, keyPath, port, upstreamPort }) {
  const server = createServer(
    {
      cert: readFileSync(certificatePath),
      key: readFileSync(keyPath),
    },
    (request, response) => {
      const host = `localhost:${port}`;
      const publicOrigin = `https://${host}`;
      if (request.headers.host !== host) {
        request.resume();
        response.writeHead(421).end();
        return;
      }
      const opaqueSameOriginDocument =
        request.headers.origin === "null" &&
        request.headers["sec-fetch-site"] === "same-origin" &&
        request.headers["sec-fetch-mode"] === "navigate" &&
        request.headers["sec-fetch-dest"] === "document";
      if (
        request.headers.origin &&
        request.headers.origin !== publicOrigin &&
        !opaqueSameOriginDocument
      ) {
        request.resume();
        response.writeHead(403).end();
        return;
      }

      const headers = { ...request.headers };
      delete headers.forwarded;
      headers.host = host;
      headers["x-forwarded-host"] = headers.host;
      headers["x-forwarded-proto"] = "https";
      headers["x-forwarded-for"] = "127.0.0.1";
      // The test server receives HTTP after TLS termination. Keep its action
      // origin check aligned after validating the browser's HTTPS origin or
      // its opaque same-origin document submission from the test certificate.
      if (headers.origin) {
        headers.origin = `http://${host}`;
      }

      const upstream = httpRequest(
        {
          hostname: "127.0.0.1",
          port: upstreamPort,
          method: request.method,
          path: request.url,
          headers,
        },
        (upstreamResponse) => {
          response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
          upstreamResponse.pipe(response);
        },
      );

      upstream.on("error", () => {
        if (!response.headersSent) {
          response.writeHead(502);
        }
        response.end();
      });
      request.pipe(upstream);
    },
  );

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(Number(port), "127.0.0.1", resolve);
  });

  return server;
}
