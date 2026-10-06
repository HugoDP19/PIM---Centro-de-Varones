const express = require('express');
const cors = require('cors');
const path = require('node:path');
const routes = require('./routes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

// Evita filtrar detalles internos al cliente.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

module.exports = app;
