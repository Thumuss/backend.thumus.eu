// Dependencies in node
import http from "http";
import https from "https";
import fs from "fs";

// Setup env
import env from "./utils/env";

// Express dependencies
import express from "express";
import cors from "cors";
import vhost from "vhost";
import proxy from "express-http-proxy";

// DB

import bsql3 from "better-sqlite3";
const db = bsql3("./dist/db/database.db");

db.pragma("journal_mode = WAL");
import { dbs, httpOrS } from "./utils";

// Api
const codes = dbs(db);
import apiWrapper from "./routes/api.js";
const api = apiWrapper(codes);

// Apps
const http_app = express();
const https_app = httpOrS() ? express() : http_app;

// Config
https_app.set("view engine", "ejs");
https_app.use(cors());

const staticOptions: Parameters<typeof express.static>[1] = {
  dotfiles: "ignore",
  extensions: ["html"],
  index: true,
  lastModified: false
}

// Redirect all http req to https
if (env.redirectHttp)
  http_app.get("*", (req, res) => {
    res.redirect("https://" + req.headers.host + req.url);
  });

// Setup api
https_app.use(vhost(`api.${env.host}`, api));

/*
Hardcode code
Redirection to the subdomain link to the port
*/
https_app.use(
  vhost(
    `*.serv.${env.host}`,
    proxy(
      (req) => {
        if (!req.headers.host) req.headers.host = "";
        const code = req.headers.host.split(".serv").slice(0, -1).join(".");
        const codeFromDb = codes.getPort.get(code) as { Port?: string };
        return codeFromDb?.Port // If it exists
          ? "http://127.0.0.1:" + codeFromDb?.Port?.split(".")[0] // then proxy that local port
          : `https://${env.host}/404`; // else redirection to an error
      },
      {
        memoizeHost: false,
        proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
          //todo: create a better reqOptDeco
          const headers = proxyReqOpts?.headers || {};
          headers["cookie"] = srcReq?.headers?.["cookie"]
            ? srcReq?.headers?.["cookie"]
            : "";
          headers["origin_ip"] = srcReq?.headers?.origin_ip || srcReq?.ip;
          proxyReqOpts.headers = headers;
          return proxyReqOpts;
        },

        preserveHostHdr: true, // prevents redirection to a domain (alias google thank you so much for that fcking redirection to your website)
      }
    )
  )
);

https_app.use(
  vhost(
    `${env.subdomainDocs}.${env.host}`,
    express.static("docs", { extensions: ["html"] })
  )
);
/*
https_app.use(
  vhost(`*.${env.host}`, (req, res) => {
    // If we don't recognise the subdomain
    res.redirect(`https://${env.host}` + req.url); // redirect to the main page
  })
);*/




const router = express.Router();

router.use(function (req, res, next) {
  const name = (req as unknown as {vhost: string[]}).vhost[0];
  if(!name) next();
  req.originalUrl = req.url;
  req.url = `/static/${name}/${req.url}`;
  next();
}) 

router.use(express.static("../frontend/extern", staticOptions));

https_app.use(vhost(`*.${env.host}`, router));

https_app.use(express.static("../frontend/build", staticOptions)); // Main page

http.createServer(http_app).listen(env.portHttp, env.ip); // For machine w multiple ips
if (httpOrS())
  https
    .createServer(
      {
        cert: fs.readFileSync(env.cert as string), // self signed cert is !fine
        key: fs.readFileSync(env.key as string),
      },
      https_app
    )
    .listen(env.portHttps, env.ip);
