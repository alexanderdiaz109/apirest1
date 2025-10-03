const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

// Semilla en memoria
let productos = [
  { id: randomUUID(), nombre: "Lapicero", precio: 15.5, stock: 100, activo: true },
  { id: randomUUID(), nombre: "Cuaderno", precio: 45, stock: 50, activo: true },
];

// Utilidades de validación
const isBoolean = v => typeof v === 'boolean';
const isNumber = v => typeof v === 'number' && !Number.isNaN(v);
const validKeys = new Set(['nombre','precio','stock','activo']);

function validarProductoCompleto(body) {
  if (typeof body?.nombre !== 'string' || body.nombre.trim() === '') return 'nombre inválido';
  if (!isNumber(body?.precio) || body.precio < 0) return 'precio inválido';
  if (!isNumber(body?.stock) || body.stock < 0) return 'stock inválido';
  if (!isBoolean(body?.activo)) return 'activo inválido';
  return null;
}

function limpiarPatch(body) {
  const out = {};
  for (const k of Object.keys(body || {})) {
    if (validKeys.has(k)) out[k] = body[k];
  }
  return out;
}

// GET /productos (con filtros)
app.get('/productos', (req, res) => {
  let out = [...productos];
  const { minPrecio, maxPrecio, activo } = req.query;

  if (minPrecio !== undefined) {
    const n = Number(minPrecio);
    if (Number.isNaN(n)) return res.status(400).json({ error: 'minPrecio debe ser numérico' });
    out = out.filter(p => p.precio >= n);
  }
  if (maxPrecio !== undefined) {
    const n = Number(maxPrecio);
    if (Number.isNaN(n)) return res.status(400).json({ error: 'maxPrecio debe ser numérico' });
    out = out.filter(p => p.precio <= n); 
  }
  if (activo !== undefined) {
    if (!['true','false'].includes(String(activo))) {
      return res.status(400).json({ error: 'activo debe ser true o false' });
    }
    const b = String(activo) === 'true';
    out = out.filter(p => p.activo === b);
  }
  res.json(out);
});

// GET /productos/:id
app.get('/productos/:id', (req, res) => {
  const prod = productos.find(p => p.id === req.params.id);
  if (!prod) return res.status(404).json({ error: 'No encontrado' });
  res.json(prod);
});

// POST /productos
app.post('/productos', (req, res) => {
  const err = validarProductoCompleto(req.body);
  if (err) return res.status(422).json({ error: err });

  const nuevo = {
    id: randomUUID(),
    nombre: req.body.nombre.trim(),
    precio: req.body.precio,
    stock: req.body.stock,
    activo: req.body.activo
  };

  productos.push(nuevo);
  res.status(201)
     .set('Location', `/productos/${nuevo.id}`)
     .json(nuevo);
});

// PUT /productos/:id (reemplazo completo; upsert)
app.put('/productos/:id', (req, res) => {
  const err = validarProductoCompleto(req.body);
  if (err) return res.status(422).json({ error: err });

  const idx = productos.findIndex(p => p.id === req.params.id);
  const reemplazo = {
    id: req.params.id,
    nombre: req.body.nombre.trim(),
    precio: req.body.precio,
    stock: req.body.stock,
    activo: req.body.activo
  };

  if (idx === -1) {
    productos.push(reemplazo);
    return res.status(201)
              .set('Location', `/productos/${reemplazo.id}`)
              .json(reemplazo);
  } else {
    productos[idx] = reemplazo;
    return res.json(reemplazo); // 200 OK
  }
});

// PATCH /productos/:id (parcial)
app.patch('/productos/:id', (req, res) => {
  const idx = productos.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });

  const cambios = limpiarPatch(req.body);
  // Validaciones mínimas por campo si vienen
  if ('nombre' in cambios) {
    if (typeof cambios.nombre !== 'string' || cambios.nombre.trim() === '') {
      return res.status(422).json({ error: 'nombre inválido' });
    }
    cambios.nombre = cambios.nombre.trim();
  }
  if ('precio' in cambios && (!isNumber(cambios.precio) || cambios.precio < 0)) {
    return res.status(422).json({ error: 'precio inválido' });
  }
  if ('stock' in cambios && (!isNumber(cambios.stock) || cambios.stock < 0)) {
    return res.status(422).json({ error: 'stock inválido' });
  }
  if ('activo' in cambios && !isBoolean(cambios.activo)) {
    return res.status(422).json({ error: 'activo inválido' });
  }

  productos[idx] = { ...productos[idx], ...cambios };
  res.json(productos[idx]);
});

// DELETE /productos/:id
app.delete('/productos/:id', (req, res) => {
  const lenBefore = productos.length;
  productos = productos.filter(p => p.id !== req.params.id);
  
  // Si la longitud no cambia, el recurso no existía
  if (productos.length === lenBefore) return res.status(404).json({ error: 'No encontrado' });
  
  return res.status(204).send();
});

// Manejador de 404 genérico (catch-all)
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador de errores (Middleware de 4 argumentos para errores 500)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API escuchando en http://localhost:${PORT}`));