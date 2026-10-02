import http from "node:http";
import { spawn } from "node:child_process";

const appPort = String(process.env.PORT || "3000");
const env = {
  ...process.env,
  HOST: "0.0.0.0",
  NITRO_HOST: "0.0.0.0",
  PORT: appPort,
};

const child = spawn(process.execPath, [".output/server/index.mjs"], {
  stdio: "inherit",
  env,
});

function forward(fromPort) {
  const server = http.createServer((req, res) => {
    const proxy = http.request(
      {
        hostname: "127.0.0.1",
        port: appPort,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (upstream) => {
        res.writeHead(upstream.statusCode ?? 502, upstream.headers);
        upstream.pipe(res);
      },
    );
    proxy.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end("Bad Gateway");
    });
    req.pipe(proxy);
  });
  server.on("error", (error) => {
    console.error(`Porta ${fromPort} não abriu: ${error.message}`);
  });
  server.listen(fromPort, "0.0.0.0", () => {
    console.log(`nex proxy em 0.0.0.0:${fromPort} -> 127.0.0.1:${appPort}`);
  });
}

if (appPort !== "80") forward(80);

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
