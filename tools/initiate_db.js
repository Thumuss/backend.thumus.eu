const db = require("better-sqlite3")("./db/database.db");
db.pragma("journal_mode = WAL");

const queries = [
  `CREATE TABLE Codes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Code VARCHAR(255) NOT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Port VARCHAR(6) NOT NULL
);`,
  `CREATE TABLE Tokens (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    Code VARCHAR(255) NOT NULL,
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    Ip VARCHAR(64) NOT NULL
);`,
];

for (const query of queries) {
  db.prepare(query).run();
}