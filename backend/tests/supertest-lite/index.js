const http = require('http');

class TestRequest {
  constructor(app, method, path) {
    this.app = app;
    this.method = method;
    this.path = path;
    this.headers = {};
    this.payload = undefined;
  }

  set(key, value) {
    this.headers[key] = value;
    return this;
  }

  send(body) {
    this.payload = body;
    return this;
  }

  then(resolve, reject) {
    return this.execute().then(resolve, reject);
  }

  catch(reject) {
    return this.execute().catch(reject);
  }

  async execute() {
    const server = http.createServer(this.app);

    return new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const body = this.payload !== undefined ? JSON.stringify(this.payload) : undefined;
        const req = http.request(
          {
            hostname: '127.0.0.1',
            port: addr.port,
            path: this.path,
            method: this.method,
            headers: {
              ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
              ...this.headers
            }
          },
          (res) => {
            let raw = '';
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
              server.close();
              let parsed = raw;
              const contentType = res.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                try {
                  parsed = raw ? JSON.parse(raw) : {};
                } catch (e) {
                  parsed = {};
                }
              }

              resolve({
                status: res.statusCode,
                body: parsed,
                text: raw,
                headers: res.headers
              });
            });
          }
        );

        req.on('error', (error) => {
          server.close();
          reject(error);
        });

        if (body) req.write(body);
        req.end();
      });
    });
  }
}

function request(app) {
  return {
    get: (path) => new TestRequest(app, 'GET', path),
    post: (path) => new TestRequest(app, 'POST', path),
    put: (path) => new TestRequest(app, 'PUT', path),
    patch: (path) => new TestRequest(app, 'PATCH', path),
    delete: (path) => new TestRequest(app, 'DELETE', path)
  };
}

module.exports = request;
