import {
  formatComparisonDate,
  formatCompliance,
  formatPace,
  kindLabel,
  plannedTargetLabel,
  roleLabel,
  sessionStatusLabel,
  setDeviationLabel,
  setStatusLabel,
} from './comparison-format.js';
import { formatClock } from './time.js';

// CSV de la comparación planificado vs realizado (Gap 35). Puro: arma el
// texto; services/csv-export(.web).js lo entrega. Separador `;` y BOM UTF-8
// para que Excel en español lo abra en columnas y con tildes.

const SEPARATOR = ';';
const BOM = '﻿';

function escapeCell(value) {
  const text = value == null ? '' : String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  return BOM + rows.map((row) => row.map(escapeCell).join(SEPARATOR)).join('\r\n') + '\r\n';
}

const meters = (value) => (value == null ? '' : String(Math.round(Number(value))));
const clock = (ms) => (ms == null ? '' : formatClock(ms));

// Una fila por serie (planificada o extra) de una sesión, más el total.
export function buildSessionComparisonCsv(comparison) {
  const header = ['Fecha', 'Sesión', 'Ejercicio', 'Rol', 'Tipo', 'Serie', 'Objetivo', 'Estado', 'Duración', 'Distancia (m)', 'Ritmo', 'Desviación', 'Cumplimiento'];
  const date = formatComparisonDate(comparison?.date);
  const rows = [header];
  (comparison?.exercises ?? []).forEach((ex) => {
    ex.sets.forEach((set) => {
      rows.push([
        date,
        comparison.sessionName,
        ex.name,
        roleLabel(ex.role),
        kindLabel(ex.kind),
        set.extra ? `${set.setNumber} (extra)` : set.setNumber,
        plannedTargetLabel(ex.planned),
        setStatusLabel(set.status),
        clock(set.durationMs),
        meters(set.distanceMeters),
        formatPace(set.paceSecPerKm) ?? '',
        setDeviationLabel(set) ?? '',
        set.extra ? '' : formatCompliance(set.compliancePct),
      ]);
    });
  });
  rows.push([date, comparison?.sessionName ?? '', 'Total de la sesión', '', '', '', '', '', clock(comparison?.totals?.actualDurationMs), meters(comparison?.totals?.actualDistanceM), '', '', formatCompliance(comparison?.compliancePct)]);
  return toCsv(rows);
}

// Una fila por sesión del rango, más el resumen.
export function buildRangeComparisonCsv(list) {
  const header = ['Fecha', 'Sesión', 'Equipo', 'Grupo', 'Tipos', 'Estado', 'Series planificadas', 'Completadas', 'Salteadas', 'Sin registro', 'Duración planificada', 'Duración real', 'Distancia planificada (m)', 'Distancia real (m)', 'Cumplimiento'];
  const rows = [header];
  (list?.sessions ?? []).forEach((s) => {
    rows.push([
      formatComparisonDate(s.date),
      s.sessionName,
      s.teamName ?? '',
      s.groupName ?? '',
      s.kinds.map(kindLabel).join(', '),
      sessionStatusLabel(s.status),
      s.totals.plannedSets,
      s.totals.completedSets,
      s.totals.skippedSets,
      s.totals.unregisteredSets,
      clock(s.totals.plannedDurationMs),
      clock(s.totals.actualDurationMs),
      meters(s.totals.plannedDistanceM),
      meters(s.totals.actualDistanceM),
      formatCompliance(s.compliancePct),
    ]);
  });
  const summary = list?.summary ?? {};
  rows.push(['Promedio del período', `${summary.sessionsPlanned ?? 0} sesiones`, '', '', '', `${summary.sessionsWithActivity ?? 0} con actividad`, '', '', '', '', '', '', '', '', formatCompliance(summary.avgCompliancePct ?? 0)]);
  return toCsv(rows);
}

export function sessionComparisonFileName(comparison, extension) {
  return `comparacion-${comparison?.date ?? 'sesion'}-${comparison?.sessionInstanceId ?? ''}.${extension}`;
}

export function rangeComparisonFileName(list, extension) {
  return `comparacion-${list?.dateFrom ?? ''}-a-${list?.dateTo ?? ''}.${extension}`;
}
