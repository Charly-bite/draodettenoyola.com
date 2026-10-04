/**
 * whatsapp-schedule.js — Lógica de Horario WhatsApp
 * Dra. Odette Noyola Landázuri · Ginecología, Obstetricia & Medicina Materno Fetal
 *
 * TASK-001 [P0]: Mensaje fuera de horario
 * ─────────────────────────────────────────
 * Horario hábil (zona: America/Mexico_City):
 *   • Lunes a Viernes:  09:00 – 21:00 hrs
 *   • Sábados:          09:00 – 16:00 hrs
 *   • Domingos / Feriados: NO disponible (todo el día)
 *
 * Comportamiento:
 *   - Horario hábil → flujo normal (abre WhatsApp con mensaje de cita)
 *   - Fuera de horario → reemplaza el texto prellenado por el mensaje
 *     dictado por la Dra. Odette el 23/09/2026
 *
 * Integración: Se interceptan todos los enlaces a wa.me/* en el sitio.
 * Compatible con analytics.js (el evento whatsapp_click se sigue disparando).
 */

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════
  // 1. CONFIGURACIÓN DE HORARIOS
  // ══════════════════════════════════════════════════════════════

  /** Zona horaria oficial de Guadalajara / CDMX */
  var TIMEZONE = 'America/Mexico_City';

  /**
   * Horarios de atención por día de la semana.
   * Clave = nombre corto del día en inglés (Intl output).
   * Valor = { start: hora_inicio, end: hora_cierre } o null si cerrado.
   */
  var SCHEDULE = {
    Mon: { start: 9, end: 21 },
    Tue: { start: 9, end: 21 },
    Wed: { start: 9, end: 21 },
    Thu: { start: 9, end: 21 },
    Fri: { start: 9, end: 21 },
    Sat: { start: 9, end: 16 },
    Sun: null // Cerrado todo el día
  };

  // ══════════════════════════════════════════════════════════════
  // 2. MENSAJE FUERA DE HORARIO (dictado por la Dra. Odette)
  // ══════════════════════════════════════════════════════════════

  /**
   * Texto exacto que se envía como mensaje prellenado en WhatsApp
   * cuando la paciente da clic fuera de horario.
   * Se usa encodeURIComponent() al construir la URL.
   */
  var OUT_OF_HOURS_MESSAGE =
    '¡Hola! *NO ESTOY DISPONIBLE* en este momento.\n\n' +
    'Mi horario de atención por WhatsApp es:\n' +
    '📅 Lunes a Viernes: 9:00 a 21:00 hrs\n' +
    '📅 Sábados: 9:00 a 16:00 hrs\n' +
    '🚫 Domingos: Descanso\n\n' +
    'Si desea conocer mis servicios, horarios y ubicación, visite:\n' +
    '🌐 https://draodettenoyola.com\n\n' +
    'Puede consultar los términos y condiciones de atención aquí:\n' +
    '📋 https://draodettenoyola.com/terminos-y-condiciones.html\n\n' +
    'Si es mi paciente en control prenatal y tiene una *urgencia real* ' +
    '(sangrado, pérdida de líquido, ausencia de movimientos fetales, ' +
    'contracciones dolorosas o signos de preeclampsia), por favor ' +
    'escriba URGENCIA y llame de inmediato al 33 2790 5726.\n\n' +
    'Con gusto le atenderé en horario hábil. 🩺✨';

  // ══════════════════════════════════════════════════════════════
  // 3. FUNCIÓN PRINCIPAL: ¿Estamos fuera de horario?
  // ══════════════════════════════════════════════════════════════

  /**
   * Determina si la hora actual en Guadalajara está fuera del
   * horario de atención de la Dra. Odette.
   * @returns {boolean} true si está fuera de horario
   */
  function isOutOfHours() {
    var now = new Date();

    // Obtener día y hora en zona de Guadalajara con Intl
    var formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      hour12: false,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric'
    });

    var parts = formatter.formatToParts(now);
    var weekday = '';
    var hour = 0;

    for (var i = 0; i < parts.length; i++) {
      if (parts[i].type === 'weekday') weekday = parts[i].value;
      if (parts[i].type === 'hour') hour = parseInt(parts[i].value, 10);
    }

    // Domingo → siempre fuera de horario
    var schedule = SCHEDULE[weekday];
    if (!schedule) return true;

    // Comparar hora actual vs rango del día
    return hour < schedule.start || hour >= schedule.end;
  }

  // ══════════════════════════════════════════════════════════════
  // 4. CONSTRUIR URL DE WHATSAPP CON MENSAJE ALTERNATIVO
  // ══════════════════════════════════════════════════════════════

  /**
   * Genera la URL de WhatsApp con el mensaje de fuera de horario.
   * Conserva el número de teléfono original del enlace.
   * @param {string} originalHref - URL original del enlace wa.me
   * @returns {string} URL modificada con texto de fuera de horario
   */
  function buildOutOfHoursUrl(originalHref) {
    // Extraer el número de teléfono del enlace original
    var phoneMatch = originalHref.match(/wa\.me\/(\d+)/);
    var phone = phoneMatch ? phoneMatch[1] : '523327905726';

    return 'https://wa.me/' + phone + '?text=' + encodeURIComponent(OUT_OF_HOURS_MESSAGE);
  }

  // ══════════════════════════════════════════════════════════════
  // 5. INTERCEPTAR CLICS EN ENLACES DE WHATSAPP
  // ══════════════════════════════════════════════════════════════

  /**
   * Listener delegado en document para interceptar clics en
   * cualquier enlace que apunte a wa.me (incluidos botones
   * flotantes, navbar, hero, footer, etc.).
   *
   * Si estamos fuera de horario:
   *   → Previene la navegación original
   *   → Reemplaza la URL con el mensaje de fuera de horario
   *   → Abre WhatsApp con el nuevo texto prellenado
   *
   * Si estamos en horario hábil:
   *   → No hace nada (flujo normal de citas)
   */
  function initWhatsAppSchedule() {
    document.addEventListener('click', function (e) {
      // Buscar el enlace más cercano (por si se hizo clic en un hijo como <svg> o <span>)
      var link = e.target.closest('a[href*="wa.me"]');
      if (!link) return;

      // Solo interceptar si estamos fuera de horario
      if (!isOutOfHours()) return;

      // Prevenir navegación original
      e.preventDefault();
      e.stopPropagation();

      // Construir URL con mensaje de fuera de horario y abrir
      var newUrl = buildOutOfHoursUrl(link.href);
      window.open(newUrl, '_blank', 'noopener,noreferrer');
    }, true); // useCapture: true para interceptar antes que analytics.js
  }

  // ══════════════════════════════════════════════════════════════
  // 6. INICIALIZACIÓN
  // ══════════════════════════════════════════════════════════════

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWhatsAppSchedule);
  } else {
    initWhatsAppSchedule();
  }

  // Exponer función para testing y depuración en consola
  window.DraOdetteSchedule = {
    isOutOfHours: isOutOfHours,
    getSchedule: function () { return SCHEDULE; },
    getMessage: function () { return OUT_OF_HOURS_MESSAGE; }
  };

})();
