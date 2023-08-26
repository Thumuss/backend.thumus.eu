// Dependencies in node
const path = require("path");
const http = require("http");
const https = require("https");
const fs = require("fs");

// Setup env
require("dotenv").config();

// Express dependencies
const express = require("express");
const cors = require("cors");
const vhost = require("vhost");
const proxy = require("express-http-proxy");

// DB
const db = require("better-sqlite3")("db/database.db");
db.pragma("journal_mode = WAL");
const { dbs, httpOrS } = require("./utils.js");

// Api
const codes = dbs(db);
const api = require("./routes/api.js")(codes);

// Apps
const http_app = express();
const https_app = httpOrS() ? express() : http_app;

// Config
https_app.set("view engine", "ejs");
https_app.use(cors());

// Redirect all http req to https
if (httpOrS())
  http_app.get("*", (req, res) => {
    res.redirect("https://" + req.headers.host + req.url);
  });

// Setup api
https_app.use(vhost(`api.${process.env.host}`, api));

/*
Hardcode code
Redirection to the subdomain link to the port
*/
https_app.use(
  vhost(
    `*.serv.${process.env.host}`,
    proxy(
      (req) => {
        const code = req.headers.host.split(".serv").slice(0, -1).join(".");
        const codeFromDb = codes.getPort.get(code);
        return codeFromDb.Port // If it exists
          ? "http://127.0.0.1:" + codeFromDb.Port // then proxy that local port
          : `https://${process.env.host}/404`; // else redirection to an error
      },
      {
        proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
          //todo: create a better reqOptDeco
          proxyReqOpts.headers["cookie"] = srcReq.headers?.["cookie"]
            ? srcReq.headers?.["cookie"]
            : "";
          proxyReqOpts.headers["origin_ip"] =
            srcReq.headers.origin_ip || srcReq.ip;

          return proxyReqOpts;
        },
        preserveHostHdr: true, // prevents redirection to a domain (alias google thank you so much for that fcking redirection to your website)
      }
    )
  )
);

https_app.use(vhost(`${process.env.subdomainDocs}.${process.env.host}`,express.static("docs",{extensions:["html"]})));

https_app.use(
  vhost(`*.${process.env.host}`, (req, res) => {
    // If we don't recognise the subdomain
    res.redirect(`https://${process.env.host}` + req.url); // redirect to the main page
  })
);

https_app.use(express.static("../frontend/build")); // Main page

https_app.use((_, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html")); // Main page too
});

http.createServer(http_app).listen(80, process.env.ip); // For machine w multiple ips
if (httpOrS())https
  .createServer(
    {
      cert: fs.readFileSync(process.env.cert), // self signed cert is !fine
      key: fs.readFileSync(process.env.key),
    },
    https_app
  )
  .listen(443, process.env.ip);
