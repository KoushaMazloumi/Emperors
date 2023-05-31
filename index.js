const http = require("http");
const fs = require("fs");
const path = require("path");

const host = "0.0.0.0";
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  // Check file path
  let filePath = req.url;
  if (filePath == "/") {
    filePath = "/index.html";
  }
  filePath = "." + filePath;
  let extname = path.extname(filePath);
  let contentType = "text/html";
  if (extname == ".js" || extname == ".mjs") {
    contentType = "application/javascript";
  }

  // If the requested file is styles1.css, return the contents of the file
  if (req.url === "/styles1.css") {
    fs.readFile("./styles1.css", "utf-8", (err, data) => {
      res.setHeader("Content-Type", "text/css");
      res.writeHead(200);
      res.write(data);
      res.end();
    });
    return;
  }

  // Read file
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code == "ENOENT") {
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/plain");
        res.end(`File not found: ${filePath}`);
        return;
      } else {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/plain");
        res.end("Internal Server Error");
        console.error(err);
        return;
      }
    }

    // Serve file
    res.statusCode = 200;
    res.setHeader("Content-Type", contentType);
    res.end(content);
  });
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/`);
});
