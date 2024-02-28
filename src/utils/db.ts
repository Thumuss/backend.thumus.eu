import { Database } from "bun:sqlite";
import { join } from "path";
import * as url from "url";
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const db = new Database(join(__dirname, "../../db/db.sqlite"));

db.run(
  `CREATE TABLE IF NOT EXISTS Codes (
        Id INTEGER PRIMARY KEY,
        Code VARCHAR(255) NOT NULL,
        Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        Port VARCHAR(6) NOT NULL,
        max DATETIME
);
CREATE TABLE IF NOT EXISTS Tokens (
        Auth BOOLEAN DEFAULT 0,
        Id INTEGER PRIMARY KEY,
        Code VARCHAR(255) NOT NULL,
        Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        Ip VARCHAR(64) NOT NULL,
        max DATETIME
);
`
);

export interface Token {
  Auth: boolean
  Id: number;
  Code: string;
  Timestamp: unknown;
  Ip: string;
  Max: unknown;
}

export interface Code {
  Id: number;
  Code: string;
  Timestamp: unknown;
  Max: unknown;
  Port: string;
}

export const insertCode = (...obj: string[]) => db.prepare("INSERT INTO Codes (Code, Port) VALUES (?, ?)").get(...obj);
export const deleteCode = (obj: string) => db.prepare<string, string>("DELETE FROM Codes WHERE Code=?").run(obj);
export const getAllCode = () => db.prepare("SELECT Code FROM Codes").all() as Code[];
export const getCode = (obj: string) => db.prepare("SELECT Code FROM Codes").get(obj) as Code | null;

export const insertToken = (...obj: string[]) => db.prepare<string, string[]>("INSERT INTO Tokens (Code, Ip) VALUES (?,?)").run(...obj);
export const insertTokenAuth = (...obj: string[]) => db.prepare<string, string[]>("INSERT INTO Tokens (Code, Ip, Auth) VALUES (?,?,0)").run(...obj);
export const getCodeToken = (obj: string) => db.prepare("SELECT * FROM Tokens WHERE Code=?").get(obj) as Token | null;
export const deleteToken = (obj: string) => db.prepare<string, string>("DELETE FROM Tokens WHERE Code=?").run(obj);
