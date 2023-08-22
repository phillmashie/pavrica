require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path"); // Import the path module

const pavricaRouter = require("./routes/pavrica.route");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(function (req, res, next) {
  // Set the Access-Control-Allow-Origin header to allow requests from any origin (*)
  res.header("Access-Control-Allow-Origin", "*");

  // Set the Access-Control-Allow-Methods header to specify the allowed HTTP methods
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");

  // Set the Access-Control-Allow-Headers header to allow the specified headers
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );

  // Set the Access-Control-Allow-Credentials header to true if needed
  // If you don't need credentials, you can remove this line or set it to false.
  res.header("Access-Control-Allow-Credentials", true);

  // Allow the preflight request to be cached for 1 hour (optional)
  res.header("Access-Control-Max-Age", "3600");

  // Check if it's a preflight request (OPTIONS method)
  if (req.method === "OPTIONS") {
    // Respond immediately for preflight requests without invoking the rest of the pipeline
    return res.status(200).end();
  }

  // Continue to the next middleware
  next();
});

// Serve the pavrica landing page from the home directory
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home/index.html"));
});

// Routes for Rica
app.use("/", pavricaRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Internal server error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// API Listening Port
app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
