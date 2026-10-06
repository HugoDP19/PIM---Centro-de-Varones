require('dotenv').config(); // debe cargarse antes de importar la app/db

const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`SICE API escuchando en http://localhost:${PORT}`);
});
