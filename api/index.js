// Vercel Serverless Function Entry Point
// Bridges incoming serverless HTTP requests to the Express application
const app = require('../server/index');

module.exports = app;
