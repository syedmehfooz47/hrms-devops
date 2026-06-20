const { Pool } = require("pg");

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "hrms",
  password: "postgres123",
  port: 5432,
});

module.exports = pool;