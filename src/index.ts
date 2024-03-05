// Dependencies in node
import http from "http";
import https from "https";
import { RequestOptions } from "https";
import fs from "fs";

// File supports
import { parse as parseYAML } from "yaml";

// Setup env
import env from "./utils/env.js";

// Express dependencies
import express, { Request } from "express";
import cors from "cors";
import morgan from "morgan";
import vhost from "vhost";
import proxy, { ProxyOptions } from "express-http-proxy";

// DB

import bsql3 from "better-sqlite3";
const db = bsql3("./db/database.db");

db.pragma("journal_mode = WAL");
import { dbs, httpOrS, pathResolveBuild, resolveWithSubdomain } from "./utils.js";

// Api
const codes = dbs(db);
import apiWrapper from "./routes/api.js";
import path from "path";
const api = apiWrapper(codes);

// Apps
const http_app = express();
const https_app = httpOrS() ? express() : http_app;

if (httpOrS()) {
  https_app.use(morgan("common"));
}
http_app.use(morgan("common"));

// Config
https_app.set("view engine", "ejs");
https_app.use(cors());

const staticOptions: Parameters<typeof express.static>[1] = {
  dotfiles: "ignore",
  extensions: ["html"],
  index: "index.html",
  lastModified: false,
};

// Redirect all http req to https
if (env.redirectHttp)
  http_app.get("*", (req, res) => {
    res.redirect("https://" + req.headers.host + req.url);
  });

// Setup api
https_app.use(vhost(`api.${env.host}`, api as unknown as vhost.Handler));

interface Proxy {
  ip?: string;
  port?: number;
  https: boolean;
  hostname?: string;
  url?: string;
}

const optionProxy: ProxyOptions = {
  memoizeHost: false,
  proxyReqOptDecorator: function (proxyReqOpts: RequestOptions, srcReq: Request) {
    //todo: create a better reqOptDeco
    const headers = proxyReqOpts?.headers || {};
    //headers["cookie"] = srcReq?.headers?.["cookie"] ? srcReq?.headers?.["cookie"] : "";
    headers["origin_ip"] = srcReq?.headers?.origin_ip || srcReq?.ip;
    //srcReq.cookies
    proxyReqOpts.headers = headers;
    const url: string | undefined = (srcReq as any).nextHost;
    console.log(url);
    if (url) {
      const urlObj = new URL(url.match(/^http/g) ? url : "http://" + url);
      proxyReqOpts.hostname = urlObj.hostname;
      proxyReqOpts.host = urlObj.host;
      proxyReqOpts.headers.host = urlObj.host;
      console.log(proxyReqOpts);
    }
    return proxyReqOpts;
  },
  userResDecorator: function (resP, resPD, resE, resED) {
    console.log(resP, resE, resED);
    return resPD;
  },
  preserveHostHdr: true,
};

/*
Redirection to the subdomain link to the port
*/
https_app.use(
  vhost(
    `*.serv.${env.host}`,
    proxy((req) => {
      if (!req.headers.host) req.headers.host = "";
      const code = req.headers.host.split(".serv").slice(0, -1).join(".");
      const codeFromDb = codes.getPort.get(code) as { Port?: string };
      return codeFromDb?.Port // If it exists
        ? "http://127.0.0.1:" + codeFromDb?.Port?.split(".")[0] // then proxy that local port
        : `https://${env.host}/404`; // else redirection to an error
    }, optionProxy) as unknown as vhost.Handler
  )
);

https_app.use(vhost(`${env.subdomainDocs}.${env.host}`, express.static("./build/docs", { extensions: ["html"] }) as unknown as vhost.Handler));

/*
https_app.use(
  vhost(`*.${env.host}`, (req, res) => {
    // If we don't recognise the subdomain
    res.redirect(`https://${env.host}` + req.url); // redirect to the main page
  })
);*/

const router = express.Router();

router.use(function (req, res, next) {
  const name = (req as unknown as { vhost: string[] }).vhost[0];
  if (!name) return next();
  req.originalUrl = req.url;
  req.url = `/static/${name}/${req.url}`;
  next();
});

router.use("/static/", express.static(pathResolveBuild(), staticOptions));
router.use("/static/", express.static(pathResolveBuild("./other"), staticOptions));

https_app.use(vhost(`*.${env.host}`, router as unknown as vhost.Handler));

https_app.use(express.static(pathResolveBuild("./frontend"), staticOptions)); // Main page

/*https_app.get("/", (_, res) => {
  res.sendFile(path.resolve(__dirname, "./build/frontend/index.html")); // Main page too
});*/

const router2 = express();

function tryRead(pathBuild: string): Proxy {
  const list = { yaml: parseYAML, yml: parseYAML, json: JSON.parse } as const;
  const keys = Object.keys(list) as (keyof typeof list)[];
  const exists = keys.filter((a) => fs.existsSync(`${pathBuild}.${a}`));
  if (exists.length === 0) return JSON.parse(fs.readFileSync(pathBuild).toString()) as Proxy;
  const type = exists.shift();
  if (!type) throw new Error();
  const ext = `.${type}`;
  return (list[type] as Function)(fs.readFileSync(pathBuild + ext).toString()) as Proxy;
}

router2.use(
  (req, res, next) => {
    const name = (req as unknown as { vhost: string[] }).vhost[0];
    const pathBuild = pathResolveBuild(name);
    try {
      const link = tryRead(pathBuild)
      const ht = link.https ? "https" : "http";
      const ifIp = `${ht}://${link.hostname ? link.hostname : link.ip || "127.0.0.1"}${link.port ? ":" + link.port : ""}`;
      (req as any).nextHost = link.url ? link.url : ifIp;
      req.url = req.originalUrl;
      next();
    } catch {
      res.json({ status: 404, redirect: resolveWithSubdomain() });
    }
  },
  proxy((req) => {
    return (req as any).nextHost;
  }, optionProxy)
);

https_app.use(vhost(`*.${env.host}`, router2));
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

const textHttp = env.http ? `${env.ip || "localhost"}:${env.portHttp}` : "";
const textHttps = env.https ? `${env.ip}:${env.portHttps}${env.http && env.https ? " and " : ""}` : "";
console.log(`* Starting server on ${textHttps}${textHttp}`);
