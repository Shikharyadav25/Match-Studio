import express from 'express';

const app = express();
const PORT = 8000;

// Use JSON middleware to parse incoming request bodies
app.use(express.json());

// Root GET route returning a short message
app.get('/', (req, res) => {
  res.send('Welcome to the Match Studio API!');
});

// Start the server and log the URL
app.listen(PORT, () => {
  console.log(`Server started at http://localhost:${PORT}`);
});
