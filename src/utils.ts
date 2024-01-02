import env from "./utils/env";
import type { Database } from "better-sqlite3";
function generate_code(i = 32) {
  const alp = "abcdefghijklmopqrstuvwxyz0123456789";
  return new Array(i)
    .fill(undefined)
    .map(() => alp[Math.round(Math.random() * alp.length)])
    .join("");
}

const dbs = (db: Database) => {
  const insertCode = db.prepare<{ code: string; port: string }>(
    "INSERT INTO Codes (Code, Port) VALUES (@code, @port)"
  );

  const getPort = db.prepare<string>("SELECT Port FROM Codes WHERE Code=?");
  const deleteCode = db.prepare<string>("DELETE FROM Codes WHERE Code=?");

  const getAllCode = db.prepare("SELECT Code FROM Codes");

  const insertToken = db.prepare<{ code: string; ip: string }>(
    "INSERT INTO Tokens (Code, Ip) VALUES (@code, @ip)"
  );
  const getCodeToken = db.prepare<string>("SELECT Id FROM Tokens WHERE Code=?");
  const deleteToken = db.prepare<string>("DELETE FROM Tokens WHERE Code=?");

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

const baseOptions = (embed: unknown) => ({
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
  tokenCreate: ({ newToken, ip }: { newToken: string, ip: string }) =>
    baseOptions({
      title: "New verification token as been created",
      color: Colors.YELLOW,
      description: `\`${newToken}\` by \`${ip}\``,
    }),
  tokenVerify: ({ newToken, ip }: { newToken: string, ip: string }) =>
    baseOptions({
      title: "New token as been added",
      color: Colors.GREEN,
      description: `\`${newToken}\` by \`${ip}\``,
    }),
  codeCreate: ({
    code,
    port,
    ip,
  }: {
    code: string;
    port: string;
    ip: string;
  }) =>
    baseOptions({
      title: "New code as been added",
      color: Colors.GREEN,
      description: `\`${code}\` at port \`${port}\` by \`${ip}\``,
    }),
  codeDelete: ({
    code,
    port,
    ip,
  }: {
    code: string;
    port: string;
    ip: string;
  }) =>
    baseOptions({
      title: "New code as been added",
      color: Colors.RED,
      description: `\`${code}\` at port \`${port}\` by \`${ip}\``,
    }),
};

const docs = (url: string) => ({
  docs: {
    url: resolveDocs(url),
    message: "Link to the documentation for more precision",
  },
});

const ownStatusGenerator = () => {
  let i = -1;
  return <X extends Status>({ type, message, ...args }: X): mappedType<X> => {
    // I don't want to make the possibility to see what is in the args
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
    } as unknown as mappedType<X>; // Horrible system
  };
};

const ownStatus = ownStatusGenerator();

interface Status<> {
  type: string;
  message: string;
}

type mappedType<S extends Status> = {
  -readonly [Property in S as Property["type"]]: {
    docs: { url: string; message: string };
    code: number;
    type: Property["type"];
    message: Property["message"];
    kind: "Error" | "OK";
  };
};

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
  ...ownStatus({
    type: "GenericResponse",
    message: "Null based response",
  } as const),
  ...ownStatus({
    type: "BadTokenException",
    message: "A bad token has been provided",
  } as const),
  ...ownStatus({
    type: "MissingPortException",
    message: "No port was provided",
  } as const),
  ...ownStatus({
    type: "MissingTokenException",
    message: "No token was provided",
  } as const),
  ...ownStatus({
    type: "MissingTokenVerifyException",
    message: "No token was provided for verifying the account",
  } as const),
  ...ownStatus({
    type: "BadTokenVerifyException",
    message: "A bad token has been provided for verifying the account",
  } as const),
  ...ownStatus({
    type: "MissingCodeException",
    message: "No code was provided",
  } as const),
  ...ownStatus({
    type: "CodeNotFoundException",
    message: "This code is expired or doesn't exist",
  } as const),
  ...ownStatus({
    type: "VerifyTokenCreated",
    message: "A new token has been send to the webhook",
  } as const),
  ...ownStatus({
    type: "VerifyTokenAccepted",
    message: "A new token has been created for you",
    token: "placeholder",
  } as const),
  ...ownStatus({
    type: "CodeCreated",
    message: "A new code has been created for you",
    code: "placeholder",
    url: "placeholder",
  } as const),
  ...ownStatus({
    type: "ListGiven",
    message: "The list of codes",
    codes: "placeholder",
  } as const),
  ...ownStatus({
    type: "CodeDeleted",
    message: "The code has been deleted",
  } as const),
};

function httpOrS() {
  return env.https;
}

function goodPortOrNot() {
  if (httpOrS()) {
    return env.portHttps === 443;
  }
  return env.portHttp === 80;
}

function resolveWithSubdomain(sub: string, path = "") {
  const type = httpOrS() ? "https" : "http";
  return `${type}://${sub}.${env.host}${
    goodPortOrNot() ? "" : `:${httpOrS() ? env.portHttps : env.portHttp}`
  }${path}`;
}

const resolveServing = (code: string) =>
  resolveWithSubdomain(`${code}.${env.subdomainServ}`);
const resolveAPI = () => resolveWithSubdomain(env.subdomainAPI);
function resolveDocs(path: string) {
  return resolveWithSubdomain(env.subdomainDocs, path);
}

export {
  dbs,
  generate_code,
  embeds,
  status,
  resolveAPI,
  resolveServing,
  resolveDocs,
  httpOrS,
};
