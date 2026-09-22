const { createServer } = require('http');
const net = require('net');
const { URL } = require('url');
const next = require('next');

const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const backend = new URL(process.env.BACKEND_INTERNAL_URL || 'http://backend:8000');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const upgradeHandler = app.getUpgradeHandler();
  const server = createServer((req, res) => handle(req, res));

  // Next's rewrites() can't proxy WebSocket upgrades, so forward /ws/* to the
  // backend container manually here; everything else (including Next's own
  // HMR socket) goes through Next's normal upgrade handler.
  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/ws/')) {
      const proxySocket = net.connect(Number(backend.port) || 80, backend.hostname, () => {
        const headerLines = [];
        for (let i = 0; i < req.rawHeaders.length; i += 2) {
          headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
        }
        proxySocket.write(`${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join('\r\n')}\r\n\r\n`);
        if (head && head.length) proxySocket.write(head);
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });
      proxySocket.on('error', () => socket.destroy());
      socket.on('error', () => proxySocket.destroy());
      return;
    }
    upgradeHandler(req, socket, head).catch(() => socket.destroy());
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
