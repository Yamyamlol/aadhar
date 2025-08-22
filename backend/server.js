import express as 'express;
const app = express();
const PORT = 3000;

app.get("/test", (req, res) => {
  res.json({ message: "Server is working!", timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});