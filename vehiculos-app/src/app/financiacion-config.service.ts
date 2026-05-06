import { Injectable } from '@angular/core';
import { FINANCIACION_CONFIG, ReglaFinanciacion } from './financiacion.config';
import { Vehiculo } from './vehiculo.model';

export interface FinanciacionConfigState {
  base: ReglaFinanciacion;
  porTipo: Record<Vehiculo['tipo'], ReglaFinanciacion>;
  porModelo: Partial<Record<string, ReglaFinanciacion>>;
}

@Injectable({
  providedIn: 'root',
})
export class FinanciacionConfigService {
  private readonly storageKey = 'financiacion_config_v1';

  getConfig(): FinanciacionConfigState {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.defaultConfig();
    }

    try {
      const parsed = JSON.parse(raw) as Partial<FinanciacionConfigState>;
      return this.normalizeConfig(parsed);
    } catch {
      return this.defaultConfig();
    }
  }

  saveConfig(config: FinanciacionConfigState): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.normalizeConfig(config)));
  }

  resetConfig(): void {
    localStorage.removeItem(this.storageKey);
  }

  // Clave canónica para reglas por modelo: "marca|modelo" en minúsculas
  buildModelKey(marca: string, modelo: string): string {
    return `${marca}|${modelo}`.trim().toLocaleLowerCase();
  }

  private defaultConfig(): FinanciacionConfigState {
    return {
      base: { ...FINANCIACION_CONFIG.base },
      porTipo: {
        auto: { ...FINANCIACION_CONFIG.porTipo.auto },
        camioneta: { ...FINANCIACION_CONFIG.porTipo.camioneta },
        moto: { ...FINANCIACION_CONFIG.porTipo.moto },
        camion: { ...FINANCIACION_CONFIG.porTipo.camion },
      },
      porModelo: { ...FINANCIACION_CONFIG.porModelo },
    };
  }

  private normalizeRule(rule: Partial<ReglaFinanciacion> | undefined, fallback: ReglaFinanciacion): ReglaFinanciacion {
    const descuentoSeguro = Number(rule?.descuentoSeguro);
    const costoMantenimiento = Number(rule?.costoMantenimiento);
    const cantidadMantenimientos = Number(rule?.cantidadMantenimientos);

    return {
      descuentoSeguro: Number.isFinite(descuentoSeguro) && descuentoSeguro >= 0 ? descuentoSeguro : fallback.descuentoSeguro,
      costoMantenimiento: Number.isFinite(costoMantenimiento) && costoMantenimiento >= 0 ? costoMantenimiento : fallback.costoMantenimiento,
      cantidadMantenimientos: Number.isFinite(cantidadMantenimientos) && cantidadMantenimientos >= 0
        ? Math.floor(cantidadMantenimientos)
        : fallback.cantidadMantenimientos,
    };
  }

  private normalizeConfig(config: Partial<FinanciacionConfigState>): FinanciacionConfigState {
    const defaults = this.defaultConfig();

    const normalizedPorModelo: Partial<Record<string, ReglaFinanciacion>> = {};
    for (const [key, value] of Object.entries(config.porModelo || {})) {
      const keyNormalizada = key.trim().toLocaleLowerCase();
      if (!keyNormalizada) {
        continue;
      }
      normalizedPorModelo[keyNormalizada] = this.normalizeRule(value, defaults.base);
    }

    return {
      base: this.normalizeRule(config.base, defaults.base),
      porTipo: {
        auto: this.normalizeRule(config.porTipo?.auto, defaults.porTipo.auto),
        camioneta: this.normalizeRule(config.porTipo?.camioneta, defaults.porTipo.camioneta),
        moto: this.normalizeRule(config.porTipo?.moto, defaults.porTipo.moto),
        camion: this.normalizeRule(config.porTipo?.camion, defaults.porTipo.camion),
      },
      porModelo: normalizedPorModelo,
    };
  }
}
