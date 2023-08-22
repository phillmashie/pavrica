const { Pool } = require("pg");

// Use environment variables for configuration
const connection = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.MYSQL_DB,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
  max: 20,
  idleTimeoutMillis: 30000,
});

// Attempt to connect to the database
connection.connect((err, client, done) => {
  if (err) {
    console.error("Error connecting to the database:", err.message);
    throw err; // Throw an error instead of exiting the application
  }

  console.log("Successfully connected to the database.");

  // Call the 'done' function to release the client back to the pool
  done();
});

connection.query("SELECT NOW()", (err, connectionres) => {
  if (err) throw err;
  console.log("DB Server: " + process.env.DB_HOST);
  console.log("DB User: " + process.env.DB_USER);
  console.log("DB : " + process.env.MYSQL_DB);
  console.log("DB Port: " + process.env.DB_PORT);
});

// Monitor connection pool events (optional but recommended)
connection.on("connect", (client) => {
  console.log("New client connected to the pool");
});

connection.on("acquire", (client) => {
  console.log("Client fetched from the pool");
});

connection.on("remove", (client) => {
  console.log("Client removed from the pool");
});

module.exports = connection;
