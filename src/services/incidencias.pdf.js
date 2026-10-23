const PDFDocument = require('pdfkit');
const path = require('node:path');

const escudo = path.join(__dirname, '../../images/images.jpg');
const rojo = '#8f1720';
const fechaHora = (valor) => new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima',
}).format(new Date(valor));

// Recibe únicamente la incidencia ya filtrada por los permisos del usuario.
function generarPdf(registro, usuario) {
  return new Promise((resolve, reject) => {
    const generado = new Date();
    const doc = new PDFDocument({
      size: 'A4', bufferPages: true,
      margins: { top: 130, bottom: 70, left: 46, right: 46 },
      info: { Title: `Reporte de incidencia ${registro.id}`, Author: usuario.nombre },
    });
    const partes = [];
    doc.on('data', (parte) => partes.push(parte));
    doc.once('end', () => resolve(Buffer.concat(partes)));
    doc.once('error', reject);
    const ancho = doc.page.width - 92;

    function encabezado() {
      doc.image(escudo, 46, 34, { fit: [45, 58] });
      doc.fillColor(rojo).font('Helvetica-Bold').fontSize(14)
        .text('I.E. N.° 20874 "Centro de Varones"', 104, 37, { width: ancho - 58 });
      doc.fillColor('#282624').fontSize(11)
        .text('Reporte de Incidencia de Convivencia Escolar', 104, 63, { width: ancho - 58 });
      doc.font('Helvetica').fontSize(9).text(`Identificador del caso: ${registro.id}`, 104, 91);
      doc.moveTo(46, 113).lineTo(doc.page.width - 46, 113).strokeColor(rojo).stroke();
      doc.font('Helvetica').fontSize(10).fillColor('#282624');
      doc.x = 46;
      doc.y = 130;
    }
    function espacio() {
      if (doc.y > doc.page.height - 120) doc.addPage();
    }
    function seccion(titulo) {
      espacio();
      doc.moveDown(0.5).font('Helvetica-Bold').fontSize(11).fillColor(rojo)
        .text(titulo, 46, doc.y, { width: ancho });
      doc.moveDown(0.4);
    }
    function campo(titulo, valor) {
      espacio();
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#555555')
        .text(titulo, 46, doc.y, { width: ancho });
      doc.font('Helvetica').fontSize(10).fillColor('#282624')
        .text(String(valor || 'No registrado'), 46, doc.y + 2, { width: ancho, lineGap: 2 });
      doc.moveDown(0.5);
    }

    try {
      doc.on('pageAdded', encabezado);
      encabezado();
      seccion('Datos del caso');
      campo('Fecha y hora del hecho', `${registro.fechaHecho} / ${registro.horaHecho || 'Hora no registrada'}`);
      campo('Nivel y grado', registro.grado);
      campo('Lugar', registro.lugarHecho);
      campo('Tipo de falta', registro.tipoFalta);
      campo('Estado', registro.estadoIncidencia);
      campo('Reportante y origen', `${registro.nombreReportante} (${registro.origenReporte})`);
      seccion('Personas involucradas');
      for (const persona of registro.involucrados) {
        campo(persona.rol, persona.oculto ? 'Testigo confidencial' : persona.nombre);
      }
      campo('Apoderado del afectado', registro.apoderadoAfectado);
      campo('Apoderado del involucrado', registro.apoderadoInvolucrado);
      seccion('Descripción de los hechos');
      campo('Hechos registrados', registro.descripcionHechos);
      seccion('Medidas y observaciones');
      campo('Medida registrada', registro.medida);
      campo('Observaciones', registro.observaciones);
      if (registro.anulacion) {
        seccion('Anulación');
        campo('Motivo', registro.anulacion.motivo);
        campo('Responsable y fecha', `Usuario ${registro.anulacion.usuarioId} / ${fechaHora(registro.anulacion.fecha)}`);
      }
      if (registro.historial?.length) {
        seccion('Historial de cambios');
        for (const evento of registro.historial) {
          campo(`${evento.accion} / ${fechaHora(evento.fecha)}`,
            `Usuario ${evento.usuarioId}: ${evento.estadoAnterior || 'Inicio'} a ${evento.estadoNuevo}${evento.motivo ? `\nMotivo: ${evento.motivo}` : ''}`);
        }
      }
      const paginas = doc.bufferedPageRange();
      for (let pagina = paginas.start; pagina < paginas.start + paginas.count; pagina++) {
        doc.switchToPage(pagina);
        doc.page.margins.bottom = 0; // El pie no debe provocar otra página.
        const y = doc.page.height;
        doc.moveTo(46, y - 62).lineTo(doc.page.width - 46, y - 62).strokeColor('#d8d2c8').stroke();
        doc.font('Helvetica').fontSize(8).fillColor('#555555');
        doc.text(`Generado por ${usuario.nombre} / ${usuario.rol}`, 46, y - 53, { width: ancho });
        doc.text(fechaHora(generado), 46, y - 24, { width: ancho - 100 });
        doc.text(`Página ${pagina + 1} de ${paginas.count}`, 46 + ancho - 100, y - 24, { width: 100, align: 'right' });
      }
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
module.exports = { generarPdf };
