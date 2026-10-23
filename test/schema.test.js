const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

// Revisión estructural del archivo; no conecta ni ejecuta MySQL.
const sql = readFileSync(path.join(__dirname, '../database/schema.sql'), 'utf8');
const tablas = new Map();
const patronTabla = /CREATE TABLE (\w+) \(([\s\S]*?)\) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;/g;
for (const coincidencia of sql.matchAll(patronTabla)) {
  tablas.set(coincidencia[1], coincidencia[2]);
}

test('modelo MySQL: 15 tablas con PK, InnoDB y utf8mb4', () => {
  const esperadas = ['ROL', 'USUARIO', 'APODERADO', 'ESTUDIANTE', 'AULA', 'MATRICULA',
    'HISTORIAL_AULA', 'ASIGNACION_AULA', 'TIPO_INCIDENCIA', 'INCIDENCIA',
    'INVOLUCRADO_INCIDENCIA', 'HISTORIAL_INCIDENCIA', 'MEDIDA_DISCIPLINARIA',
    'ATENCION_MEDIDA', 'HISTORIAL_MEDIDA'];
  assert.deepEqual([...tablas.keys()], esperadas);
  for (const cuerpo of tablas.values()) {
    assert.equal([...cuerpo.matchAll(/PRIMARY KEY/g)].length, 1);
    assert.equal([...cuerpo.matchAll(/AUTO_INCREMENT/g)].length, 1);
  }
  assert.doesNotMatch(sql, /\bdbo\.|\bIDENTITY\b|\bNVARCHAR\b|\bDATETIME2\b|^GO$|\bPERSISTED\b/m);
});

test('modelo MySQL: 24 FK ordenadas con columnas, tipos y claves de destino válidos', () => {
  let cantidad = 0;
  const definidas = new Map();
  for (const [nombre, cuerpo] of tablas) {
    const columnas = new Map();
    for (const columna of cuerpo.matchAll(/^    (\w+) (\w+)/gm)) columnas.set(columna[1], columna[2]);
    for (const fk of cuerpo.matchAll(/FOREIGN KEY \(([^)]+)\)\s+REFERENCES (\w+) \(([^)]+)\)/g)) {
      cantidad++;
      const origen = fk[1].split(',').map((valor) => valor.trim());
      const destino = fk[3].split(',').map((valor) => valor.trim());
      const padre = definidas.get(fk[2]);
      assert.ok(padre, `La tabla ${fk[2]} debe existir antes de ${nombre}`);
      const claves = [...padre.cuerpo.matchAll(/(?:PRIMARY KEY|UNIQUE) \(([^)]+)\)/g)]
        .map((clave) => clave[1].replaceAll(' ', ''));
      assert.ok(claves.includes(destino.join(',')), `Falta PK/UNIQUE para ${fk[2]}`);
      assert.equal(origen.length, destino.length);
      origen.forEach((columna, index) => {
        assert.ok(columnas.has(columna) && padre.columnas.has(destino[index]));
        assert.equal(columnas.get(columna), padre.columnas.get(destino[index]));
      });
    }
    definidas.set(nombre, { cuerpo, columnas });
  }
  assert.equal(cantidad, 24);
});

test('modelo MySQL: nombres únicos y claves para periodos abiertos y testigos externos', () => {
  const nombres = [...sql.matchAll(/CONSTRAINT (\w+)/g)].map((valor) => valor[1]);
  assert.equal(new Set(nombres).size, nombres.length);
  assert.ok(nombres.every((nombre) => nombre.length <= 64));
  assert.match(tablas.get('HISTORIAL_AULA'), /CASE WHEN fecha_fin IS NULL THEN 1 ELSE NULL END/);
  assert.match(tablas.get('HISTORIAL_AULA'), /UNIQUE \(id_matricula, periodo_abierto\)/);
  assert.match(sql, /CREATE UNIQUE INDEX UX_INV_estudiante_rol[\s\S]*?\(id_incidencia, id_matricula, rol_involucrado\)\s*;/);
});
