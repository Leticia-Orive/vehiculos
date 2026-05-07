import { FinanciacionConfigService } from './financiacion-config.service';

describe('FinanciacionConfigService', () => {
  let service: FinanciacionConfigService;

  beforeEach(() => {
    localStorage.clear();
    service = new FinanciacionConfigService();
  });

  it('normaliza marca y modelo al construir la clave', () => {
    const key = service.buildModelKey('  Toyota   ', '  Corolla  Cross ');
    expect(key).toBe('toyota|corolla cross');
  });

  it('normaliza claves por modelo al guardar y recuperar configuracion', () => {
    const config = service.getConfig();
    config.porModelo = {
      '  TOYOTA   |   COROLLA  ': {
        descuentoSeguro: 123,
        costoMantenimiento: 456,
        cantidadMantenimientos: 7,
      },
    };

    service.saveConfig(config);
    const persisted = service.getConfig();

    expect(persisted.porModelo['toyota|corolla']).toEqual({
      descuentoSeguro: 123,
      costoMantenimiento: 456,
      cantidadMantenimientos: 7,
    });
    expect(persisted.porModelo['  TOYOTA   |   COROLLA  ']).toBeUndefined();
  });

  it('ignora entradas invalidas y recupera fallback cuando localStorage esta corrupto', () => {
    localStorage.setItem('financiacion_config_v1', JSON.stringify({
      porModelo: {
        '   |   ': {
          descuentoSeguro: 200,
          costoMantenimiento: 100,
          cantidadMantenimientos: 3,
        },
      },
      base: {
        descuentoSeguro: -1,
        costoMantenimiento: Number.NaN,
        cantidadMantenimientos: -10,
      },
    }));

    const normalized = service.getConfig();

    expect(normalized.porModelo['|']).toBeUndefined();
    expect(normalized.base.descuentoSeguro).toBeGreaterThanOrEqual(0);
    expect(normalized.base.costoMantenimiento).toBeGreaterThanOrEqual(0);
    expect(normalized.base.cantidadMantenimientos).toBeGreaterThanOrEqual(0);
  });
});
