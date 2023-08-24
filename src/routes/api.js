const rateLimit = require("express-rate-limit");
const express = require("express");
const { generate_code, embeds, status, resolveServing } = require("../utils.js");
const tempTokens = [];

const api = (dbs) => {
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
    await fetch(
      process.env.webhook,
      embeds.tokenCreate({ newToken, ip: req.ip })
    );
    tempTokens.push(newToken);

    setTimeout(() => {
      delete tempTokens[newToken];
    }, 1000 * 60 * 15);

    res.status(200).json(status.VerifyTokenCreated);
  });

  router.post("/token/verify", async (req, res) => {
    if (!req.body.token)
      return res
        .status(400)
        .json(status.MissingTokenVerifyException);

    const index = tempTokens.findIndex((a) => a === req.body.token);

    if (index === -1)
      return res
        .status(400)
        .json(status.BadTokenVerifyException);

    const newToken = generate_code(256);
    dbs.insertToken.run({ code: newToken, ip: req.ip });
    delete tempTokens[index];

    await fetch(
      process.env.webhook,
      embeds.tokenVerify({ newToken, ip: req.ip })
    );

    res
      .status(200)
      .json({ ...status.VerifyTokenAccepted, token: newToken });
  });

  router.use(function (req, res, next) {
    const isAToken = dbs.getCodeToken.get(req.body.token);
    if (!isAToken) {
      return res
        .status(400)
        .json(status.BadTokenException);
    }
    next();
  });

  router.post("/create", async (req, res) => {
    if (!req.body?.port)
      return res
        .status(400)
        .json(status.MissingPortException);

    if (!req.body?.code || req.body?.code === "random")
      req.body.code = generate_code();

    dbs.insertCode.run({ code: req.body.code, port: req.body.port });

    res.status(200).json({
      ...status.CodeCreated,
      code: req.body.code,
      url: resolveServing(req.body.code),
    });

    await fetch(
      process.env.webhook,
      codeCreate({ code: req.body.code, port: req.body.port, ip: req.ip })
    );
  });

  router.post("/list", (req, res) => {
    res.status(200).json({
      ...status.ListGiven,
      codes: dbs.getAllCode.all().map((a) => a.Code),
    });
  });

  router.post("/delete", async (req, res) => {
    if (!req.body?.code) {
      return res
        .status(400)
        .json(status.MissingCodeException);
    }

    const port = dbs.getPort.get(req.body.code);
    if (!port)
      return res
        .status(400)
        .json(status.CodeNotFoundException);

    await fetch(
      process.env.webhook,
      codeDelete({ code: req.body.code, port: req.body.port, ip: req.ip })
    );

    dbs.deleteCode.run(req.body.code);

    res.status(200).json(status.CodeDeleted);
  });

  return router;
};

module.exports = api;
