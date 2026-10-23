const express = require('express');
const cors = require('cors');
const path = require('node:path');
const cookieParser = require('cookie-parser');
const auth = require('./config/auth');
const { protegerEscritura } = require('./middlewares/auth');
const routes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: auth.origin, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
}, protegerEscritura);

app.use(express.static('public'));
app.use('/images', express.static(path.join(__dirname, '..', 'images')));
app.use('/api', routes);

app.use((req, res) => res.status(404).json({ message: 'Ruta no encontrada' }));

// Evita filtrar detalles internos al cliente.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ message: 'Solicitud demasiado grande' });
  console.error('Error interno en la API');
  res.status(500).json({ message: 'Error interno del servidor' });
});

module.exports = app;
