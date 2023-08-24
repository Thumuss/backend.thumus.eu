function generate_code(i = 32) {
  const alp = "abcdefghijklmopqrstuvwxyz0123456789";
  return new Array(i)
    .fill()
    .map(() => alp[Math.round(Math.random() * alp.length)])
    .join("");
}

/**
 *
 * @param {import("better-sqlite3").Database} db
 */
const dbs = (db) => {
  const insertCode = db.prepare(
    `INSERT INTO Codes (Code, Port) VALUES (@code, @port)`
  );
  const getPort = db.prepare(`SELECT Port FROM Codes WHERE Code=?`);
  const deleteCode = db.prepare(`DELETE FROM Codes WHERE Code=?`);

  const getAllCode = db.prepare(`SELECT Code FROM Codes`);

  const insertToken = db.prepare(
    `INSERT INTO Tokens (Code, Ip) VALUES (@code, @ip)`
  );
  const getCodeToken = db.prepare(`SELECT Id FROM Tokens WHERE Code=?`);
  const deleteToken = db.prepare(`DELETE FROM Tokens WHERE Code=?`);

  return {
    insertCode,
    getPort,
    deleteCode,

    insertToken,
    getCodeToken,
    deleteToken,

    getAllCode,
  };
};

const baseOptions = (embed) => ({
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    embeds: [embed],
  }),
});

const Colors = {
  YELLOW: 16776960,
  GREEN: 65280,
  RED: 16711680,
};

const embeds = {
  tokenCreate: ({ newToken, ip }) =>
    baseOptions({
      title: "New verification token as been created",
      color: Colors.YELLOW,
      description: `\`${newToken}\` by \`${ip}\``,
    }),
  tokenVerify: ({ newToken, ip }) =>
    baseOptions({
      title: "New token as been added",
      color: Colors.GREEN,
      description: `\`${newToken}\` by \`${ip}\``,
    }),
  codeCreate: ({ code, port, ip }) =>
    baseOptions({
      title: "New code as been added",
      color: Colors.GREEN,
      description: `\`${code}\` at port \`${port}\` by \`${ip}\``,
    }),
  codeDelete: ({ code, port, ip }) =>
    baseOptions({
      title: "New code as been added",
      color: Colors.RED,
      description: `\`${code}\` at port \`${port}\` by \`${ip}\``,
    }),
};

const docs = (url) => ({
  docs: {
    url: resolveDocs(url),
    message: "Link to the documentation for more precision",
  },
});

const ownStatusGenerator = () => {
  let i = -1;
  return ({ type, message, ...args }) => {
    i++;
    return {
      [type]: {
        code: 2400 + i,
        type,
        message,
        kind: type.includes("Exception") ? "Error" : "OK",
        ...args,
        ...docs(`/status/${type}`),
      },
    };
  };
};

const ownStatus = ownStatusGenerator();
const multipleStatus = (status) =>
  status
    .map((stat) => ownStatus(stat))
    .reduce(
      (stack, stat) => ({
        ...stack,
        ...stat,
      }),
      {}
    );

const status = {
  NotFoundException: {
    code: 404,
    type: "NotFoundException",
    message: "Page not found",
  },
  UnauthorizeException: {
    code: 401,
    type: "UnauthorizeException",
    message: "Unauthorize, you need to login",
    ...docs("/status/UnauthorizedException"),
  },
  ...multipleStatus([
    {
      type: "GenericResponse",
      message: "Null based response",
    },
    {
      type: "BadTokenException",
      message: "A bad token has been provided",
    },
    {
      type: "MissingPortException",
      message: "No port was provided",
    },
    {
      type: "MissingTokenException",
      message: "No token was provided",
    },
    {
      type: "MissingTokenVerifyException",
      message: "No token was provided for verifying the account",
    },
    {
      type: "BadTokenVerifyException",
      message: "A bad token has been provided for verifying the account",
    },
    {
      type: "MissingCodeException",
      message: "No code was provided",
    },
    {
      type: "CodeNotFoundException",
      message: "This code is expired or doesn't exist",
    },
    {
      type: "VerifyTokenCreated",
      message: "A new token has been send to the webhook",
    },
    {
      type: "VerifyTokenAccepted",
      message: "A new token has been created for you",
      token: "placeholder",
    },
    {
      type: "CodeCreated",
      message: "A new code has been created for you",
      code: "placeholder",
      url: "placeholder",
    },
    {
      type: "ListGiven",
      message: "The list of codes",
      codes: "placeholder",
    },
    {
      type: "CodeDeleted",
      message: "The code has been deleted",
    },
  ]),
};

function httpOrS() {
  return process.env.https === "true";
}

function goodPortOrNot() {
  if (httpOrS()) {
    return process.env.portHttps === "443";
  }
  return process.env.portHttp === "80";
}

function resolveWithSubdomain(sub, path = "") {
  const type = httpOrS() ? "https" : "http";
  return `${type}://${sub}.${process.env.host}${
    goodPortOrNot()
      ? ""
      : `:${httpOrS() ? process.env.portHttps : process.env.portHttp}`
  }${path}`;
}

const resolveServing = (code) =>
  resolveWithSubdomain(`${code}.${process.env.subdomainServ}`);
const resolveAPI = () => resolveWithSubdomain(process.env.subdomainAPI);
function resolveDocs(path) {
  return resolveWithSubdomain(process.env.subdomainDocs, path);
}

module.exports = {
  dbs,
  generate_code,
  embeds,
  status,
  resolveAPI,
  resolveServing,
  resolveDocs,
  httpOrS
};
