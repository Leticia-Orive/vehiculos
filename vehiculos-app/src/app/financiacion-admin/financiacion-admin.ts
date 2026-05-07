import { Component, DoCheck, OnDestroy, OnInit } from '@angular/core';
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

type AutosaveEstado = 'off' | 'pending' | 'blocked' | 'synced';
type ToastTipo = 'info' | 'success' | 'warning';

interface HistorialAccion {
  descripcion: string;
  hora: Date;
}

@Component({
  selector: 'app-financiacion-admin',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './financiacion-admin.html',
  styleUrl: './financiacion-admin.scss',
})
export class FinanciacionAdminComponent implements OnInit, DoCheck, OnDestroy {
  private readonly limites = {
    descuentoSeguro: { min: 0, max: 20000, warning: 5000 },
    costoMantenimiento: { min: 0, max: 8000, warning: 2000 },
    cantidadMantenimientos: { min: 0, max: 24, warning: 12 },
  } as const;
  private readonly nombreMinLength = 2;
  private readonly nombreMaxLength = 40;
  private readonly nombrePermitidoRegex = /^[\p{L}\p{N}][\p{L}\p{N}\s\-./]*$/u;
  private readonly horaGuardadoFormatter = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  config: FinanciacionConfigState | null = null;
  tiposVehiculo: TipoVehiculo[] = ['auto', 'camioneta', 'moto', 'camion'];

  reglasModelo: ReglaModeloRow[] = [];
  nuevaMarca: string = '';
  nuevoModelo: string = '';
  marcaTouched: boolean = false;
  modeloTouched: boolean = false;
  mensaje: string = '';
  error: string = '';
  advertencias: string[] = [];
  historialAcciones: HistorialAccion[] = [];
  ultimoGuardado: Date | null = null;
  toastVisible: boolean = false;
  toastMensaje: string = '';
  toastTipo: ToastTipo = 'info';
  private configSnapshot: string = '';
  autosaveEnabled: boolean = false;
  private readonly autosaveStorageKey = 'financiacion_admin_autosave';
  private readonly autosaveDelayMs = 1500;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastObservedConfigSnapshot: string = '';
  private readonly toastDurationMs = 2200;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private financiacionConfigService: FinanciacionConfigService) {}

  ngOnInit(): void {
    this.autosaveEnabled = localStorage.getItem(this.autosaveStorageKey) === '1';
    this.cargarConfig();
  }

  ngDoCheck(): void {
    if (!this.config) {
      return;
    }

    const currentSnapshot = this.serializeConfig(this.config);
    if (currentSnapshot === this.lastObservedConfigSnapshot) {
      return;
    }

    this.lastObservedConfigSnapshot = currentSnapshot;

    if (this.autosaveEnabled && this.hayCambiosPendientes) {
      this.programarAutosave();
    }
  }

  ngOnDestroy(): void {
    this.limpiarAutosaveProgramado();
    this.ocultarToast();
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
    this.configSnapshot = this.serializeConfig(this.config);
    this.lastObservedConfigSnapshot = this.configSnapshot;
    this.ultimoGuardado = new Date();
    this.limpiarAutosaveProgramado();
    this.registrarAccion('Guardado manual');
    this.mostrarToast('Cambios guardados manualmente.', this.advertencias.length > 0 ? 'warning' : 'success');
    this.mensaje = this.advertencias.length > 0
      ? 'Configuración guardada con advertencias.'
      : 'Configuración guardada correctamente.';
  }

  descartarCambios(): void {
    if (!this.hayCambiosPendientes) {
      return;
    }

    if (!window.confirm('Se perderán los cambios no guardados. ¿Deseas continuar?')) {
      return;
    }

    this.cargarConfig();
    this.error = '';
    this.advertencias = [];
    this.mensaje = 'Cambios no guardados descartados.';
    this.limpiarAutosaveProgramado();
    this.registrarAccion('Cambios descartados');
    this.mostrarToast('Cambios descartados.', 'info');
  }

  restaurarPorDefecto(): void {
    if (this.hayCambiosPendientes && !window.confirm('Tienes cambios sin guardar. ¿Quieres restaurar por defecto?')) {
      return;
    }

    this.financiacionConfigService.resetConfig();
    this.cargarConfig();
    this.mensaje = 'Configuración restaurada a valores por defecto.';
    this.error = '';
    this.advertencias = [];
    this.limpiarAutosaveProgramado();
    this.registrarAccion('Restaurado por defecto');
    this.mostrarToast('Configuración restaurada.', 'info');
  }

  agregarReglaModelo(): void {
    this.error = '';
    this.mensaje = '';
    this.advertencias = [];
    this.marcaTouched = true;
    this.modeloTouched = true;

    if (!this.config) {
      return;
    }

    const marca = this.nuevaMarca.trim();
    const modelo = this.nuevoModelo.trim();

    const errorMarca = this.validarCampoModelo(marca, 'Marca');
    if (errorMarca) {
      this.error = errorMarca;
      return;
    }

    const errorModelo = this.validarCampoModelo(modelo, 'Modelo');
    if (errorModelo) {
      this.error = errorModelo;
      return;
    }

    if (this.errorDuplicadoModelo) {
      this.error = this.errorDuplicadoModelo;
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
    this.marcaTouched = false;
    this.modeloTouched = false;
    this.sincronizarReglasModelo();
    this.mensaje = 'Regla por modelo añadida. Guarda los cambios para persistirla.';
  }

  get nuevaMarcaError(): string | null {
    if (!this.marcaTouched) {
      return null;
    }

    return this.validarCampoModelo(this.nuevaMarca.trim(), 'Marca');
  }

  get nuevoModeloError(): string | null {
    if (!this.modeloTouched) {
      return null;
    }

    return this.validarCampoModelo(this.nuevoModelo.trim(), 'Modelo');
  }

  get nuevaMarcaLength(): number {
    return this.nuevaMarca.trim().length;
  }

  get nuevoModeloLength(): number {
    return this.nuevoModelo.trim().length;
  }

  get nuevaMarcaInlineError(): string | null {
    return this.nuevaMarcaError;
  }

  get nuevoModeloInlineError(): string | null {
    return this.nuevoModeloError ?? this.errorDuplicadoModelo;
  }

  get errorDuplicadoModelo(): string | null {
    if (!this.config || !this.marcaTouched || !this.modeloTouched) {
      return null;
    }

    const marca = this.nuevaMarca.trim();
    const modelo = this.nuevoModelo.trim();

    if (this.validarCampoModelo(marca, 'Marca') || this.validarCampoModelo(modelo, 'Modelo')) {
      return null;
    }

    const key = this.financiacionConfigService.buildModelKey(marca, modelo);
    return this.config.porModelo[key] ? 'Ya existe una regla para ese modelo.' : null;
  }

  get puedeAgregarReglaModelo(): boolean {
    if (!this.config) {
      return false;
    }

    return !this.validarCampoModelo(this.nuevaMarca.trim(), 'Marca')
      && !this.validarCampoModelo(this.nuevoModelo.trim(), 'Modelo')
      && !this.errorDuplicadoModelo;
  }

  get hayCambiosPendientes(): boolean {
    if (!this.config) {
      return false;
    }

    return this.serializeConfig(this.config) !== this.configSnapshot;
  }

  get ultimoGuardadoLabel(): string {
    if (!this.ultimoGuardado) {
      return '';
    }

    return this.formatearHora(this.ultimoGuardado);
  }

  formatearHora(fecha: Date): string {
    return this.horaGuardadoFormatter.format(fecha);
  }

  get autosaveEstado(): AutosaveEstado {
    if (!this.autosaveEnabled) {
      return 'off';
    }

    if (!this.hayCambiosPendientes) {
      return 'synced';
    }

    if (this.tieneErroresValidacion()) {
      return 'blocked';
    }

    return 'pending';
  }

  get autosaveEstadoLabel(): string {
    switch (this.autosaveEstado) {
      case 'off':
        return 'Autosave desactivado';
      case 'blocked':
        return 'Autosave bloqueado por errores';
      case 'pending':
        return this.autosaveTimer ? 'Autosave pendiente...' : 'Cambios pendientes de autosave';
      case 'synced':
        return 'Autosave al día';
      default:
        return '';
    }
  }

  onAutosaveToggle(value: boolean): void {
    this.autosaveEnabled = value;
    localStorage.setItem(this.autosaveStorageKey, value ? '1' : '0');

    if (value && this.hayCambiosPendientes) {
      this.programarAutosave();
      return;
    }

    this.limpiarAutosaveProgramado();
  }

  onMarcaChange(value: string): void {
    this.nuevaMarca = value;
    this.marcaTouched = true;
    this.error = '';
  }

  onModeloChange(value: string): void {
    this.nuevoModelo = value;
    this.modeloTouched = true;
    this.error = '';
  }

  private validarTextoModelo(valor: string, campo: 'Marca' | 'Modelo'): string | null {
    if (valor.length < this.nombreMinLength || valor.length > this.nombreMaxLength) {
      return `${campo} debe tener entre ${this.nombreMinLength} y ${this.nombreMaxLength} caracteres.`;
    }

    if (!this.nombrePermitidoRegex.test(valor)) {
      return `${campo} contiene caracteres no permitidos. Usa letras, números, espacios, guion, punto o barra.`;
    }

    return null;
  }

  private validarCampoModelo(valor: string, campo: 'Marca' | 'Modelo'): string | null {
    if (!valor) {
      return `${campo} es obligatoria.`;
    }

    return this.validarTextoModelo(valor, campo);
  }

  eliminarReglaModelo(key: string): void {
    if (!this.config) {
      return;
    }

    delete this.config.porModelo[key];
    this.sincronizarReglasModelo();
    this.mensaje = 'Regla por modelo eliminada. Guarda los cambios para persistirlo.';
    this.error = '';
    this.advertencias = [];
    this.registrarAccion('Regla por modelo eliminada');
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
    this.configSnapshot = this.config ? this.serializeConfig(this.config) : '';
    this.lastObservedConfigSnapshot = this.configSnapshot;
  }

  private programarAutosave(): void {
    this.limpiarAutosaveProgramado();
    this.autosaveTimer = setTimeout(() => {
      this.ejecutarAutosave();
    }, this.autosaveDelayMs);
  }

  private limpiarAutosaveProgramado(): void {
    if (!this.autosaveTimer) {
      return;
    }

    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = null;
  }

  private ejecutarAutosave(): void {
    this.autosaveTimer = null;

    if (!this.autosaveEnabled || !this.config || !this.hayCambiosPendientes) {
      return;
    }

    if (this.tieneErroresValidacion()) {
      return;
    }

    this.error = '';
    this.advertencias = this.generarAdvertencias();
    this.financiacionConfigService.saveConfig(this.config);
    this.configSnapshot = this.serializeConfig(this.config);
    this.lastObservedConfigSnapshot = this.configSnapshot;
    this.ultimoGuardado = new Date();
    this.registrarAccion('Guardado automático');
    this.mostrarToast(
      this.advertencias.length > 0 ? 'Autosave aplicado con advertencias.' : 'Autosave aplicado.',
      this.advertencias.length > 0 ? 'warning' : 'success'
    );
    this.mensaje = this.advertencias.length > 0
      ? 'Cambios guardados automáticamente con advertencias.'
      : 'Cambios guardados automáticamente.';
  }

  private tieneErroresValidacion(): boolean {
    return this.validarConfig().length > 0;
  }

  private registrarAccion(descripcion: string): void {
    this.historialAcciones = [{ descripcion, hora: new Date() }, ...this.historialAcciones].slice(0, 3);
  }

  private mostrarToast(mensaje: string, tipo: ToastTipo): void {
    this.ocultarToast();
    this.toastVisible = true;
    this.toastMensaje = mensaje;
    this.toastTipo = tipo;
    this.toastTimer = setTimeout(() => {
      this.toastVisible = false;
      this.toastTimer = null;
    }, this.toastDurationMs);
  }

  private ocultarToast(): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.toastVisible = false;
  }

  exportarConfiguracion(): void {
    if (!this.config) {
      return;
    }

    const json = JSON.stringify(this.config, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financiacion-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.registrarAccion('Configuración exportada');
    this.mostrarToast('Configuración exportada como JSON.', 'info');
  }

  importarConfiguracion(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const normalizada = this.financiacionConfigService.normalizeConfigPublic(parsed);
        this.config = normalizada;
        this.sincronizarReglasModelo();
        this.error = '';
        this.advertencias = [];
        this.mensaje = 'Configuración importada correctamente. Guarda los cambios para persistirla.';
        this.registrarAccion('Configuración importada');
        this.mostrarToast('Configuración importada.', 'success');
      } catch {
        this.error = 'El archivo no es un JSON de configuración válido.';
        this.mostrarToast('Error al importar el archivo.', 'warning');
      }

      input.value = '';
    };

    reader.readAsText(file);
  }

  private serializeConfig(config: FinanciacionConfigState): string {
    const sortedPorModelo = Object.entries(config.porModelo)
      .filter(([, regla]) => !!regla)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .reduce<Partial<Record<string, ReglaFinanciacion>>>((acc, [key, regla]) => {
        acc[key] = regla;
        return acc;
      }, {});

    return JSON.stringify({
      base: config.base,
      porTipo: config.porTipo,
      porModelo: sortedPorModelo,
    });
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
