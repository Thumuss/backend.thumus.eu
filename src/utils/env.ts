import "dotenv/config";
import z from "zod";

const port = z.number().int().nonnegative().lte(65535);

const zobj = z
  .object({
    cert: z.string().min(1).optional(),
    key: z.string().min(1).optional(),
    webhook: z.string().url(),
    host: z.string().min(1).default("localhost"),
    ip: z.string().ip({ version: "v4" }).optional(),
    subdomainServ: z.string().min(1).default("serv"),
    subdomainAPI: z.string().min(1).default("api"),
    subdomainDocs: z.string().min(1).default("docs"),
    https: z.boolean().default(true),
    http: z.boolean().default(true),
    portHttp: port.optional().default(80),
    portHttps: port.optional().default(443),
  })
  .superRefine((data, ctx) => {
    if (data.https && (!data.cert || !data.key))
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "If you use https, you need to set cert and key, two path to your cert.pem and key.pem ",
      });
  })

function parseEnv() {
  const keys = Object.keys(zobj);
  return keys
    .map((a) => {
      const obj = process.env[a];
      if (!obj) {
        return undefined;
      }
      if (obj === "true" || obj === "false") {
        return { [a]: (obj === "true") };
      } else if (!isNaN(parseInt(obj))) {
        return { [a]: parseInt(obj) };
      }
      return {[a]: obj}
      
    })
    .filter(a => typeof a !== "undefined")
    .reduce((a, b) => ({ ...a, ...b }), {});
}

const parsed = zobj.safeParse(parseEnv());
if (!parsed.success) {
  throw Error(parsed.error.errors.join("\n"))
}

export default parsed.data;
