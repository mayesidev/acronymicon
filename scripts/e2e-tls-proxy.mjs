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
      const headers = { ...request.headers };
      delete headers.forwarded;
      headers.host = `localhost:${port}`;
      headers["x-forwarded-host"] = headers.host;
      headers["x-forwarded-proto"] = "https";
      headers["x-forwarded-for"] = "127.0.0.1";

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
