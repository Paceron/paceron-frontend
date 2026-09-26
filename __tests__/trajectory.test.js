import { buildTrajectoryPath } from '../utils/trajectory.js';

const at = (latitude, longitude) => ({ latitude, longitude });

describe('buildTrajectoryPath', () => {
  test('menos de 2 puntos → null (no hay línea que dibujar)', () => {
    expect(buildTrajectoryPath([])).toBeNull();
    expect(buildTrajectoryPath(null)).toBeNull();
    expect(buildTrajectoryPath([at(-34.6, -58.38)])).toBeNull();
  });

  test('descarta puntos con coordenadas inválidas', () => {
    expect(buildTrajectoryPath([at(-34.6, -58.38), null, at(NaN, -58.38), at(-34.59, -58.37)])).not.toBeNull();
  });

  test('si todos los puntos son inválidos → null', () => {
    expect(buildTrajectoryPath([at(NaN, NaN), { latitude: 1 }])).toBeNull();
  });

  test('genera un path SVG con M inicial y L para el resto', () => {
    const shape = buildTrajectoryPath([at(0, 0), at(0, 0.001), at(0, 0.002)], { size: 100, padding: 10 });
    expect(shape.d).toMatch(/^M[\d.]+ [\d.]+ L/);
    expect(shape.d.split('L')).toHaveLength(3);
  });

  test('respeta el padding: el recorrido queda adentro del recuadro', () => {
    const size = 100;
    const padding = 10;
    // Diagonal (0,0) → (1,1): con la latitud invertida, (0,0) queda abajo-
    // izquierda y (1,1) arriba-derecha.
    const shape = buildTrajectoryPath([at(0, 0), at(1, 1)], { size, padding });
    expect(shape.start).toEqual({ x: padding, y: size - padding });
    expect(shape.end).toEqual({ x: size - padding, y: padding });
  });

  test('la latitud se invierte (norte arriba, como en un mapa)', () => {
    // Dos puntos en el mismo meridiano: el que está más al norte (latitud
    // mayor) debe quedar con Y MENOR (arriba en pantalla).
    const shape = buildTrajectoryPath([at(0, 0), at(1, 0)], { size: 100, padding: 0 });
    expect(shape.start.y).toBeGreaterThan(shape.end.y);
  });

  test('recorrido recto perfectly horizontal → no rompe (rango 0 en un eje)', () => {
    const shape = buildTrajectoryPath([at(5, 0), at(5, 0.001), at(5, 0.002)], { size: 100 });
    expect(shape.d).toBeTruthy();
    // Con latitud constante, todos los Y quedan centrados.
    expect(shape.start.y).toBeCloseTo(shape.end.y, 1);
  });

  test('recorrido recto vertical → tampoco rompe', () => {
    const shape = buildTrajectoryPath([at(0, 3), at(0.001, 3), at(0.002, 3)], { size: 100 });
    expect(shape.d).toBeTruthy();
  });

  test('reporta las dimensiones reales en metros para scalear la figura', () => {
    const shape = buildTrajectoryPath([at(0, 0), at(0, 0.001)], { size: 100 });
    // 0.001° de longitud ≈ 111 m en el ecuador.
    expect(shape.metersWide).toBeGreaterThan(100);
    expect(shape.metersWide).toBeLessThan(120);
    expect(shape.metersTall).toBeCloseTo(0, 1);
  });

  test('reporta la cantidad de puntos válidos', () => {
    const shape = buildTrajectoryPath([at(0, 0), at(0, 0.001), at(NaN, 1), at(0, 0.002)], { size: 100 });
    expect(shape.pointCount).toBe(3);
  });

  test('start y end son el primer y último punto', () => {
    const shape = buildTrajectoryPath([at(0, 0), at(0.0005, 0.0005), at(0.001, 0.001)], { size: 100, padding: 0 });
    expect(shape.start).toEqual({ x: 0, y: 100 });
    expect(shape.end).toEqual({ x: 100, y: 0 });
  });
});
