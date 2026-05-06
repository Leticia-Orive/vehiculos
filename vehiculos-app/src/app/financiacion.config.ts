import { Vehiculo } from './vehiculo.model';

export interface ReglaFinanciacion {
  descuentoSeguro: number;
  costoMantenimiento: number;
  cantidadMantenimientos: number;
}

export const FINANCIACION_CONFIG: {
  base: ReglaFinanciacion;
  porTipo: Record<Vehiculo['tipo'], ReglaFinanciacion>;
  porModelo: Partial<Record<string, ReglaFinanciacion>>;
} = {
  // Regla de respaldo por si se añade un tipo nuevo en el futuro
  base: {
    descuentoSeguro: 850,
    costoMantenimiento: 300,
    cantidadMantenimientos: 4,
  },
  // Reglas por tipo/gama de vehículo
  porTipo: {
    auto: {
      descuentoSeguro: 800,
      costoMantenimiento: 280,
      cantidadMantenimientos: 4,
    },
    camioneta: {
      descuentoSeguro: 1000,
      costoMantenimiento: 360,
      cantidadMantenimientos: 4,
    },
    moto: {
      descuentoSeguro: 500,
      costoMantenimiento: 180,
      cantidadMantenimientos: 4,
    },
    camion: {
      descuentoSeguro: 1500,
      costoMantenimiento: 500,
      cantidadMantenimientos: 4,
    },
  },
  // Reglas por modelo exacto: prioridad más alta (clave: "marca|modelo" en minúsculas)
  porModelo: {
    'toyota|corolla': {
      descuentoSeguro: 900,
      costoMantenimiento: 260,
      cantidadMantenimientos: 4,
    },
    'ford|f-150': {
      descuentoSeguro: 1200,
      costoMantenimiento: 390,
      cantidadMantenimientos: 4,
    },
    'honda|cbr600': {
      descuentoSeguro: 620,
      costoMantenimiento: 170,
      cantidadMantenimientos: 4,
    },
  },
};
