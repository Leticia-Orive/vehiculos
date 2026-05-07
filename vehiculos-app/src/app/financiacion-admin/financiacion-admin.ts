import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { FinanciacionConfigService, FinanciacionConfigState } from '../financiacion-config.service';
import { ReglaFinanciacion } from '../financiacion.config';
import { Vehiculo } from '../vehiculo.model';

type TipoVehiculo = Vehiculo['tipo'];

interface ReglaModeloRow {
  key: string;
  marca: string;
  modelo: string;
  regla: ReglaFinanciacion;
}

@Component({
  selector: 'app-financiacion-admin',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './financiacion-admin.html',
  styleUrl: './financiacion-admin.scss',
})
export class FinanciacionAdminComponent implements OnInit {
  private readonly limites = {
    descuentoSeguro: { min: 0, max: 20000, warning: 5000 },
    costoMantenimiento: { min: 0, max: 8000, warning: 2000 },
    cantidadMantenimientos: { min: 0, max: 24, warning: 12 },
  } as const;

  config: FinanciacionConfigState | null = null;
  tiposVehiculo: TipoVehiculo[] = ['auto', 'camioneta', 'moto', 'camion'];

  reglasModelo: ReglaModeloRow[] = [];
  nuevaMarca: string = '';
  nuevoModelo: string = '';
  mensaje: string = '';
  error: string = '';
  advertencias: string[] = [];

  constructor(private financiacionConfigService: FinanciacionConfigService) {}

  ngOnInit(): void {
    this.cargarConfig();
  }

  guardarCambios(): void {
    this.error = '';
    this.mensaje = '';
    this.advertencias = [];

    if (!this.config) {
      return;
    }

    const errores = this.validarConfig();
    if (errores.length > 0) {
      this.error = errores.join(' | ');
      return;
    }

    this.advertencias = this.generarAdvertencias();

    this.financiacionConfigService.saveConfig(this.config);
    this.mensaje = this.advertencias.length > 0
      ? 'Configuración guardada con advertencias.'
      : 'Configuración guardada correctamente.';
  }

  restaurarPorDefecto(): void {
    this.financiacionConfigService.resetConfig();
    this.cargarConfig();
    this.mensaje = 'Configuración restaurada a valores por defecto.';
    this.error = '';
    this.advertencias = [];
  }

  agregarReglaModelo(): void {
    this.error = '';
    this.mensaje = '';
    this.advertencias = [];

    if (!this.config) {
      return;
    }

    const marca = this.nuevaMarca.trim();
    const modelo = this.nuevoModelo.trim();

    if (!marca || !modelo) {
      this.error = 'Marca y modelo son obligatorios para añadir una regla.';
      return;
    }

    const key = this.financiacionConfigService.buildModelKey(marca, modelo);
    if (this.config.porModelo[key]) {
      this.error = 'Ya existe una regla para ese modelo.';
      return;
    }

    this.config.porModelo[key] = {
      ...this.config.base,
    };

    this.nuevaMarca = '';
    this.nuevoModelo = '';
    this.sincronizarReglasModelo();
  }

  eliminarReglaModelo(key: string): void {
    if (!this.config) {
      return;
    }

    delete this.config.porModelo[key];
    this.sincronizarReglasModelo();
    this.mensaje = '';
    this.error = '';
    this.advertencias = [];
  }

  etiquetaTipo(tipo: TipoVehiculo): string {
    switch (tipo) {
      case 'auto': return 'Auto';
      case 'camioneta': return 'Camioneta';
      case 'moto': return 'Moto';
      case 'camion': return 'Camión';
      default: return tipo;
    }
  }

  private cargarConfig(): void {
    this.config = this.financiacionConfigService.getConfig();
    this.sincronizarReglasModelo();
    this.advertencias = [];
  }

  private validarConfig(): string[] {
    if (!this.config) {
      return [];
    }

    const errores: string[] = [];
    errores.push(...this.validarRegla(this.config.base, 'Regla base'));

    for (const tipo of this.tiposVehiculo) {
      errores.push(...this.validarRegla(this.config.porTipo[tipo], `Tipo ${this.etiquetaTipo(tipo)}`));
    }

    for (const fila of this.reglasModelo) {
      errores.push(...this.validarRegla(fila.regla, `Modelo ${fila.marca} ${fila.modelo}`));
    }

    return errores;
  }

  private validarRegla(regla: ReglaFinanciacion, contexto: string): string[] {
    const errores: string[] = [];

    if (!Number.isFinite(regla.descuentoSeguro) || regla.descuentoSeguro < this.limites.descuentoSeguro.min || regla.descuentoSeguro > this.limites.descuentoSeguro.max) {
      errores.push(`${contexto}: Seguro debe estar entre ${this.limites.descuentoSeguro.min} y ${this.limites.descuentoSeguro.max}.`);
    }

    if (!Number.isFinite(regla.costoMantenimiento) || regla.costoMantenimiento < this.limites.costoMantenimiento.min || regla.costoMantenimiento > this.limites.costoMantenimiento.max) {
      errores.push(`${contexto}: Mantenimiento debe estar entre ${this.limites.costoMantenimiento.min} y ${this.limites.costoMantenimiento.max}.`);
    }

    if (!Number.isFinite(regla.cantidadMantenimientos) || regla.cantidadMantenimientos < this.limites.cantidadMantenimientos.min || regla.cantidadMantenimientos > this.limites.cantidadMantenimientos.max) {
      errores.push(`${contexto}: Cantidad de mantenimientos debe estar entre ${this.limites.cantidadMantenimientos.min} y ${this.limites.cantidadMantenimientos.max}.`);
    }

    return errores;
  }

  private generarAdvertencias(): string[] {
    if (!this.config) {
      return [];
    }

    const advertencias: string[] = [];
    advertencias.push(...this.advertenciasRegla(this.config.base, 'Regla base'));

    for (const tipo of this.tiposVehiculo) {
      advertencias.push(...this.advertenciasRegla(this.config.porTipo[tipo], `Tipo ${this.etiquetaTipo(tipo)}`));
    }

    for (const fila of this.reglasModelo) {
      advertencias.push(...this.advertenciasRegla(fila.regla, `Modelo ${fila.marca} ${fila.modelo}`));
    }

    return advertencias;
  }

  private advertenciasRegla(regla: ReglaFinanciacion, contexto: string): string[] {
    const avisos: string[] = [];

    if (regla.descuentoSeguro > this.limites.descuentoSeguro.warning) {
      avisos.push(`${contexto}: Seguro alto (${regla.descuentoSeguro}).`);
    }
    if (regla.costoMantenimiento > this.limites.costoMantenimiento.warning) {
      avisos.push(`${contexto}: Mantenimiento alto (${regla.costoMantenimiento}).`);
    }
    if (regla.cantidadMantenimientos > this.limites.cantidadMantenimientos.warning) {
      avisos.push(`${contexto}: Cantidad de mantenimientos alta (${regla.cantidadMantenimientos}).`);
    }

    return avisos;
  }

  private sincronizarReglasModelo(): void {
    if (!this.config) {
      this.reglasModelo = [];
      return;
    }

    this.reglasModelo = Object.entries(this.config.porModelo)
      .reduce<ReglaModeloRow[]>((filas, [key, regla]) => {
        if (!regla) {
          return filas;
        }

        const [marca = '', modelo = ''] = key.split('|');
        filas.push({
          key,
          marca,
          modelo,
          regla,
        });
        return filas;
      }, [])
      .sort((a, b) => a.key.localeCompare(b.key));
  }
}
