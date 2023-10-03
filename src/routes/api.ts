import env from "../utils/env";
import rateLimit from "express-rate-limit";
import express from "express";
import {
  generate_code,
  embeds,
  status,
  resolveServing,
  type dbs,
} from "../utils";

const tempTokens: { [ip: string]: string } = {};

const api = (database: ReturnType<typeof dbs>) => {
  const limit = rateLimit({
    windowMs: 15 * 60 * 1000 * 4, // 1h
    max: 20,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  const router = express.Router();

  router.use(limit);
  router.use(express.json());

  router.post("/token/create", async (req, res) => {
    const newToken = generate_code(256);
    await fetch(env.webhook, embeds.tokenCreate({ newToken, ip: req.ip }));
    tempTokens[req.ip] = newToken;

    setTimeout(() => {
      delete tempTokens[req.ip];
    }, 1000 * 60 * 15);

    res.status(200).json(status.VerifyTokenCreated);
  });

  router.post("/token/verify", async (req, res) => {
    if (!req.body.token)
      return res.status(400).json(status.MissingTokenVerifyException);

    const index = tempTokens[req.ip] && tempTokens[req.ip] === req.body.token;

    if (!index) return res.status(400).json(status.BadTokenVerifyException);

    const newToken = generate_code(256);
    database.insertToken.run({ code: newToken, ip: req.ip });
    delete tempTokens[req.ip];

    await fetch(env.webhook, embeds.tokenVerify({ newToken, ip: req.ip }));

    res.status(200).json({ ...status.VerifyTokenAccepted, token: newToken });
  });

  router.use(function (req, res, next) {
    const isAToken = database.getCodeToken.get(req.body.token);
    if (!isAToken) {
      return res.status(400).json(status.BadTokenException);
    }
    next();
  });

  router.post("/code/create", async (req, res) => {
    if (!req.body?.port)
      return res.status(400).json(status.MissingPortException);

    if (!req.body?.code || req.body?.code === "random")
      req.body.code = generate_code();

    database.insertCode.run({ code: req.body.code, port: req.body.port });

    res.status(200).json({
      ...status.CodeCreated,
      code: req.body.code,
      url: resolveServing(req.body.code),
    });

    await fetch(
      env.webhook,
      embeds.codeCreate({
        code: req.body.code,
        port: req.body.port,
        ip: req.ip,
      })
    );
  });

  router.post("/code/list", (req, res) => {
    res.status(200).json({
      ...status.ListGiven,
      codes: database.getAllCode
        .all()
        .map((a) => (a as { Code: unknown }).Code),
    });
  });

  router.post("/code/delete", async (req, res) => {
    if (!req.body?.code) {
      return res.status(400).json(status.MissingCodeException);
    }

    const port = database.getPort.get(req.body.code) as
      | { Port: string }
      | undefined;
    if (!port) return res.status(400).json(status.CodeNotFoundException);

    await fetch(
      env.webhook,
      embeds.codeDelete({
        code: req.body.code,
        port: port.Port.split(".")[0],
        ip: req.ip,
      })
    );

    database.deleteCode.run(req.body.code);

    res.status(200).json(status.CodeDeleted);
  });

  return router;
};

export default api;
