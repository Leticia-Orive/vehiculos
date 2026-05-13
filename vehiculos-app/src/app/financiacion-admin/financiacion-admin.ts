import { Component, DoCheck, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
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

interface ImportacionPreview {
  baseCambiada: boolean;
  tiposCambiados: number;
  modelosNuevos: number;
  modelosActualizados: number;
  modelosEliminados: number;
  clavesModelosNuevos: string[];
  clavesModelosActualizados: string[];
  clavesModelosEliminados: string[];
}

@Component({
  selector: 'app-financiacion-admin',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './financiacion-admin.html',
  styleUrl: './financiacion-admin.scss',
})
/**
 * Panel administrativo de reglas de financiación.
 * Permite editar configuración base/tipo/modelo, validar cambios y gestionar import/export.
 */
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
  filtroModelo: string = '';
  filtroTipo: string = '';
  ordenReglas: 'asc' | 'desc' = 'asc';
  seccionesAbiertas: Record<string, boolean> = { base: true, tipo: true, modelo: true };
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
  importacionTexto: string = '';
  mostrarImportacionTexto: boolean = false;
  filtroPreviewKeys: string = '';
  previewImportacion: ImportacionPreview | null = null;
  configPrevisualizadaImport: FinanciacionConfigState | null = null;
  private configSnapshot: string = '';
  autosaveEnabled: boolean = false;
  private readonly autosaveStorageKey = 'financiacion_admin_autosave';
  private readonly uiStateStorageKey = 'financiacion_admin_ui_state';
  private readonly autosaveDelayMs = 1500;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastObservedConfigSnapshot: string = '';
  private readonly toastDurationMs = 2200;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private undoStack: FinanciacionConfigState[] = [];
  private readonly maxUndoLevels = 5;
  private uiStateSnapshot: string = '';

  constructor(
    private financiacionConfigService: FinanciacionConfigService,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Admin Financiación | Vehículos');
    this.autosaveEnabled = localStorage.getItem(this.autosaveStorageKey) === '1';
    this.cargarConfig();
    this.loadUiState();
  }

  ngDoCheck(): void {
    if (!this.config) {
      return;
    }

    const currentUiState = this.serializeUiState();
    if (currentUiState !== this.uiStateSnapshot) {
      this.uiStateSnapshot = currentUiState;
      localStorage.setItem(this.uiStateStorageKey, currentUiState);
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

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      if (this.hayCambiosPendientes) {
        this.guardarCambios();
      }
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.exportarConfiguracion();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'c') {
      event.preventDefault();
      void this.copiarConfiguracion();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') {
      event.preventDefault();
      this.toggleImportacionTexto();
      return;
    }

    if (event.key === 'Escape' && this.hayFiltrosActivos) {
      this.limpiarFiltros();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
      event.preventDefault();
      if (this.puedeDeshacer) {
        this.deshacer();
      }
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
    this.mostrarToast(
      'Cambios guardados manualmente.',
      this.advertencias.length > 0 ? 'warning' : 'success',
    );
    this.mensaje =
      this.advertencias.length > 0
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
    if (
      this.hayCambiosPendientes &&
      !window.confirm('Tienes cambios sin guardar. ¿Quieres restaurar por defecto?')
    ) {
      return;
    }

    this.pushUndo();
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

    this.pushUndo();

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

    return (
      !this.validarCampoModelo(this.nuevaMarca.trim(), 'Marca') &&
      !this.validarCampoModelo(this.nuevoModelo.trim(), 'Modelo') &&
      !this.errorDuplicadoModelo
    );
  }

  get puedeDeshacer(): boolean {
    return this.undoStack.length > 0;
  }

  deshacer(): void {
    const prev = this.undoStack.shift();
    if (!prev || !this.config) {
      return;
    }

    this.config = prev;
    this.sincronizarReglasModelo();
    this.error = '';
    this.advertencias = [];
    this.registrarAccion('Acción deshecha');
    this.mostrarToast('Última acción deshecha.', 'info');
  }

  get tiposFiltrados(): TipoVehiculo[] {
    const query = this.normalizeSearch(this.filtroTipo);
    if (!query) {
      return this.tiposVehiculo;
    }

    return this.tiposVehiculo.filter((tipo) =>
      this.normalizeSearch(this.etiquetaTipo(tipo)).includes(query),
    );
  }

  get hayFiltrosActivos(): boolean {
    return this.filtroModelo.trim().length > 0 || this.filtroTipo.trim().length > 0;
  }

  toggleSeccion(id: string): void {
    this.seccionesAbiertas[id] = !this.seccionesAbiertas[id];
  }

  expandirTodo(): void {
    this.seccionesAbiertas = { base: true, tipo: true, modelo: true };
  }

  colapsarTodo(): void {
    this.seccionesAbiertas = { base: false, tipo: false, modelo: false };
  }

  limpiarFiltros(): void {
    this.filtroModelo = '';
    this.filtroTipo = '';
    this.mostrarToast('Filtros limpiados.', 'info');
  }

  restablecerABase(fila: ReglaModeloRow): void {
    if (!this.config) {
      return;
    }

    this.pushUndo();
    fila.regla = { ...this.config.base };
    this.registrarAccion(`Restablecida a base: ${fila.marca} ${fila.modelo}`);
    this.mostrarToast(
      `Valores de "${fila.marca} ${fila.modelo}" restablecidos a la regla base.`,
      'info',
    );
  }

  aplicarABasePorTipo(): void {
    if (!this.config) {
      return;
    }

    this.pushUndo();
    for (const tipo of this.tiposVehiculo) {
      this.config.porTipo[tipo] = { ...this.config.base };
    }

    this.registrarAccion('Todas las reglas por tipo restablecidas a base');
    this.mostrarToast('Todas las reglas por tipo restablecidas a la base.', 'success');
  }

  aplicarABasePorModelo(): void {
    if (!this.config) {
      return;
    }

    this.pushUndo();
    Object.keys(this.config.porModelo).forEach((key) => {
      this.config!.porModelo[key] = { ...this.config!.base };
    });

    this.registrarAccion('Todas las reglas por modelo restablecidas a base');
    this.mostrarToast('Todas las reglas por modelo restablecidas a la base.', 'success');
  }

  ocurridoCambioEnSeccion(seccion: 'base' | 'tipo' | 'modelo'): boolean {
    if (!this.config || !this.configSnapshot) {
      return false;
    }

    try {
      const actual = JSON.parse(this.serializeConfig(this.config));
      const guardada = JSON.parse(this.configSnapshot);

      switch (seccion) {
        case 'base':
          return JSON.stringify(actual.base) !== JSON.stringify(guardada.base);
        case 'tipo':
          return JSON.stringify(actual.porTipo) !== JSON.stringify(guardada.porTipo);
        case 'modelo':
          return JSON.stringify(actual.porModelo) !== JSON.stringify(guardada.porModelo);
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  tieneReglaModeloCambios(key: string): boolean {
    if (!this.config || !this.configSnapshot) {
      return false;
    }

    try {
      const guardada = JSON.parse(this.configSnapshot);
      const reglaGuardada = guardada.porModelo?.[key];
      const reglaActual = this.config.porModelo[key];
      return JSON.stringify(reglaActual) !== JSON.stringify(reglaGuardada);
    } catch {
      return false;
    }
  }

  claseCampoValor(valor: number, campo: keyof typeof this.limites): string {
    const l = this.limites[campo];
    if (valor > l.max || valor < 0) {
      return 'campo-fuera-rango';
    }

    if (valor > l.warning) {
      return 'campo-advertencia';
    }

    return '';
  }

  toggleOrdenReglas(): void {
    this.ordenReglas = this.ordenReglas === 'asc' ? 'desc' : 'asc';
  }

  get reglasModeloFiltradas(): ReglaModeloRow[] {
    const q = this.normalizeSearch(this.filtroModelo);
    const lista = q
      ? this.reglasModelo.filter(
          (r) =>
            this.normalizeSearch(r.marca).includes(q) || this.normalizeSearch(r.modelo).includes(q),
        )
      : [...this.reglasModelo];

    return lista.sort((a, b) =>
      this.ordenReglas === 'asc' ? a.key.localeCompare(b.key) : b.key.localeCompare(a.key),
    );
  }

  get hayCambiosPendientes(): boolean {
    if (!this.config) {
      return false;
    }

    return this.serializeConfig(this.config) !== this.configSnapshot;
  }

  get totalReglasModelo(): number {
    return this.reglasModelo.length;
  }

  get totalAdvertenciasActuales(): number {
    if (!this.config) {
      return 0;
    }

    return this.generarAdvertencias().length;
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

  duplicarReglaModelo(row: ReglaModeloRow): void {
    this.nuevaMarca = row.marca;
    this.nuevoModelo = row.modelo;
    this.marcaTouched = false;
    this.modeloTouched = false;
    this.mostrarToast(
      `Marca y modelo copiados de "${row.marca} ${row.modelo}". Edítalos y añade la nueva regla.`,
      'info',
    );
  }

  eliminarReglaModelo(key: string): void {
    if (!this.config) {
      return;
    }

    this.pushUndo();
    delete this.config.porModelo[key];
    this.sincronizarReglasModelo();
    this.mensaje = 'Regla por modelo eliminada. Guarda los cambios para persistirlo.';
    this.error = '';
    this.advertencias = [];
    this.registrarAccion('Regla por modelo eliminada');
  }

  etiquetaTipo(tipo: TipoVehiculo): string {
    switch (tipo) {
      case 'auto':
        return 'Auto';
      case 'camioneta':
        return 'Camioneta';
      case 'moto':
        return 'Moto';
      case 'camion':
        return 'Camión';
      default:
        return tipo;
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
      this.advertencias.length > 0 ? 'warning' : 'success',
    );
    this.mensaje =
      this.advertencias.length > 0
        ? 'Cambios guardados automáticamente con advertencias.'
        : 'Cambios guardados automáticamente.';
  }

  private tieneErroresValidacion(): boolean {
    return this.validarConfig().length > 0;
  }

  private registrarAccion(descripcion: string): void {
    this.historialAcciones = [{ descripcion, hora: new Date() }, ...this.historialAcciones].slice(
      0,
      3,
    );
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
    if (
      this.hayCambiosPendientes &&
      !window.confirm('Hay cambios sin guardar. ¿Deseas reemplazarlos al importar?')
    ) {
      const input = event.target as HTMLInputElement;
      input.value = '';
      return;
    }

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
        this.mensaje =
          'Configuración importada correctamente. Guarda los cambios para persistirla.';
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

  toggleImportacionTexto(): void {
    this.mostrarImportacionTexto = !this.mostrarImportacionTexto;

    if (!this.mostrarImportacionTexto) {
      this.limpiarImportacionTexto();
    }
  }

  get clavesNuevosFiltradas(): string[] {
    const f = this.filtroPreviewKeys.trim().toLowerCase();
    if (!this.previewImportacion) return [];
    return f
      ? this.previewImportacion.clavesModelosNuevos.filter((k) => k.toLowerCase().includes(f))
      : this.previewImportacion.clavesModelosNuevos;
  }

  get clavesActualizadosFiltradas(): string[] {
    const f = this.filtroPreviewKeys.trim().toLowerCase();
    if (!this.previewImportacion) return [];
    return f
      ? this.previewImportacion.clavesModelosActualizados.filter((k) => k.toLowerCase().includes(f))
      : this.previewImportacion.clavesModelosActualizados;
  }

  get clavesEliminadosFiltradas(): string[] {
    const f = this.filtroPreviewKeys.trim().toLowerCase();
    if (!this.previewImportacion) return [];
    return f
      ? this.previewImportacion.clavesModelosEliminados.filter((k) => k.toLowerCase().includes(f))
      : this.previewImportacion.clavesModelosEliminados;
  }

  limpiarImportacionTexto(): void {
    this.importacionTexto = '';
    this.previewImportacion = null;
    this.configPrevisualizadaImport = null;
    this.filtroPreviewKeys = '';
  }

  importarDesdeTexto(): void {
    const raw = this.importacionTexto.trim();
    if (!raw) {
      this.mostrarToast('Pega un JSON para importar.', 'warning');
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const normalizada = this.financiacionConfigService.normalizeConfigPublic(parsed);
      const configActual = this.config ?? this.financiacionConfigService.getConfig();
      this.configPrevisualizadaImport = normalizada;
      this.previewImportacion = this.construirPreviewImportacion(configActual, normalizada);
      this.error = '';
      this.mostrarToast('Previsualización lista. Revisa y aplica los cambios.', 'info');
    } catch {
      this.previewImportacion = null;
      this.configPrevisualizadaImport = null;
      this.error = 'El JSON pegado no es válido para configuración.';
      this.mostrarToast('No se pudo importar el JSON pegado.', 'warning');
    }
  }

  aplicarImportacionPrevisualizada(): void {
    if (!this.configPrevisualizadaImport) {
      this.mostrarToast('Primero previsualiza un JSON válido.', 'warning');
      return;
    }

    if (
      this.hayCambiosPendientes &&
      !window.confirm('Hay cambios sin guardar. ¿Deseas reemplazarlos al importar?')
    ) {
      return;
    }

    this.config = this.configPrevisualizadaImport;
    this.sincronizarReglasModelo();
    this.error = '';
    this.advertencias = [];
    this.mensaje = 'Configuración importada desde texto. Guarda los cambios para persistirla.';
    this.registrarAccion('Configuración importada desde texto');
    this.mostrarToast('Configuración importada desde texto.', 'success');
    this.importacionTexto = '';
    this.mostrarImportacionTexto = false;
    this.previewImportacion = null;
    this.configPrevisualizadaImport = null;
  }

  private construirPreviewImportacion(
    actual: FinanciacionConfigState,
    propuesta: FinanciacionConfigState,
  ): ImportacionPreview {
    const baseCambiada = JSON.stringify(actual.base) !== JSON.stringify(propuesta.base);

    const tiposCambiados = this.tiposVehiculo.reduce((acc, tipo) => {
      const igual =
        JSON.stringify(actual.porTipo[tipo]) === JSON.stringify(propuesta.porTipo[tipo]);
      return igual ? acc : acc + 1;
    }, 0);

    const actualKeys = new Set(Object.keys(actual.porModelo));
    const propuestaKeys = new Set(Object.keys(propuesta.porModelo));

    const clavesModelosNuevos: string[] = [];
    const clavesModelosEliminados: string[] = [];
    const clavesModelosActualizados: string[] = [];

    for (const key of propuestaKeys) {
      if (!actualKeys.has(key)) {
        clavesModelosNuevos.push(key);
        continue;
      }

      const actualRegla = actual.porModelo[key];
      const propuestaRegla = propuesta.porModelo[key];
      if (JSON.stringify(actualRegla) !== JSON.stringify(propuestaRegla)) {
        clavesModelosActualizados.push(key);
      }
    }

    for (const key of actualKeys) {
      if (!propuestaKeys.has(key)) {
        clavesModelosEliminados.push(key);
      }
    }

    clavesModelosNuevos.sort((a, b) => a.localeCompare(b));
    clavesModelosActualizados.sort((a, b) => a.localeCompare(b));
    clavesModelosEliminados.sort((a, b) => a.localeCompare(b));

    return {
      baseCambiada,
      tiposCambiados,
      modelosNuevos: clavesModelosNuevos.length,
      modelosActualizados: clavesModelosActualizados.length,
      modelosEliminados: clavesModelosEliminados.length,
      clavesModelosNuevos,
      clavesModelosActualizados,
      clavesModelosEliminados,
    };
  }

  async copiarConfiguracion(): Promise<void> {
    if (!this.config) {
      return;
    }

    const json = JSON.stringify(this.config, null, 2);

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(json);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = json;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      this.registrarAccion('Configuración copiada al portapapeles');
      this.mostrarToast('Configuración copiada al portapapeles.', 'info');
    } catch {
      this.mostrarToast('No se pudo copiar la configuración.', 'warning');
    }
  }

  private pushUndo(): void {
    if (!this.config) {
      return;
    }

    this.undoStack = [JSON.parse(JSON.stringify(this.config)), ...this.undoStack].slice(
      0,
      this.maxUndoLevels,
    );
  }

  private serializeUiState(): string {
    return JSON.stringify({
      seccionesAbiertas: this.seccionesAbiertas,
      filtroModelo: this.filtroModelo,
      filtroTipo: this.filtroTipo,
      ordenReglas: this.ordenReglas,
    });
  }

  private loadUiState(): void {
    try {
      const stored = localStorage.getItem(this.uiStateStorageKey);
      if (!stored) {
        return;
      }

      const state = JSON.parse(stored);
      if (state && typeof state.seccionesAbiertas === 'object') {
        this.seccionesAbiertas = { ...this.seccionesAbiertas, ...state.seccionesAbiertas };
      }

      if (typeof state.filtroModelo === 'string') {
        this.filtroModelo = state.filtroModelo;
      }

      if (typeof state.filtroTipo === 'string') {
        this.filtroTipo = state.filtroTipo;
      }

      if (state.ordenReglas === 'asc' || state.ordenReglas === 'desc') {
        this.ordenReglas = state.ordenReglas;
      }

      this.uiStateSnapshot = this.serializeUiState();
    } catch {
      // ignore malformed state
    }
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
      errores.push(
        ...this.validarRegla(this.config.porTipo[tipo], `Tipo ${this.etiquetaTipo(tipo)}`),
      );
    }

    for (const fila of this.reglasModelo) {
      errores.push(...this.validarRegla(fila.regla, `Modelo ${fila.marca} ${fila.modelo}`));
    }

    return errores;
  }

  private validarRegla(regla: ReglaFinanciacion, contexto: string): string[] {
    const errores: string[] = [];

    if (
      !Number.isFinite(regla.descuentoSeguro) ||
      regla.descuentoSeguro < this.limites.descuentoSeguro.min ||
      regla.descuentoSeguro > this.limites.descuentoSeguro.max
    ) {
      errores.push(
        `${contexto}: Seguro debe estar entre ${this.limites.descuentoSeguro.min} y ${this.limites.descuentoSeguro.max}.`,
      );
    }

    if (
      !Number.isFinite(regla.costoMantenimiento) ||
      regla.costoMantenimiento < this.limites.costoMantenimiento.min ||
      regla.costoMantenimiento > this.limites.costoMantenimiento.max
    ) {
      errores.push(
        `${contexto}: Mantenimiento debe estar entre ${this.limites.costoMantenimiento.min} y ${this.limites.costoMantenimiento.max}.`,
      );
    }

    if (
      !Number.isFinite(regla.cantidadMantenimientos) ||
      regla.cantidadMantenimientos < this.limites.cantidadMantenimientos.min ||
      regla.cantidadMantenimientos > this.limites.cantidadMantenimientos.max
    ) {
      errores.push(
        `${contexto}: Cantidad de mantenimientos debe estar entre ${this.limites.cantidadMantenimientos.min} y ${this.limites.cantidadMantenimientos.max}.`,
      );
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
      advertencias.push(
        ...this.advertenciasRegla(this.config.porTipo[tipo], `Tipo ${this.etiquetaTipo(tipo)}`),
      );
    }

    for (const fila of this.reglasModelo) {
      advertencias.push(
        ...this.advertenciasRegla(fila.regla, `Modelo ${fila.marca} ${fila.modelo}`),
      );
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
      avisos.push(
        `${contexto}: Cantidad de mantenimientos alta (${regla.cantidadMantenimientos}).`,
      );
    }

    return avisos;
  }

  private capitalize(s: string): string {
    return s.replace(/\b\w/gu, (c) => c.toLocaleUpperCase());
  }

  private normalizeSearch(value: string): string {
    return value
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase();
  }

  private sincronizarReglasModelo(): void {
    if (!this.config) {
      this.reglasModelo = [];
      return;
    }

    this.reglasModelo = Object.entries(this.config.porModelo).reduce<ReglaModeloRow[]>(
      (filas, [key, regla]) => {
        if (!regla) {
          return filas;
        }

        const [marcaRaw = '', modeloRaw = ''] = key.split('|');
        filas.push({
          key,
          marca: this.capitalize(marcaRaw),
          modelo: this.capitalize(modeloRaw),
          regla,
        });
        return filas;
      },
      [],
    );
  }
}
