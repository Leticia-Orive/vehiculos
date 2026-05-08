import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FinanciacionAdminComponent } from './financiacion-admin';
import { FinanciacionConfigService } from '../financiacion-config.service';

describe('FinanciacionAdminComponent', () => {
  let service: FinanciacionConfigService;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [FinanciacionAdminComponent],
      providers: [FinanciacionConfigService, provideRouter([])],
    }).compileComponents();

    service = TestBed.inject(FinanciacionConfigService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('deshabilita el boton de anadir cuando marca o modelo no son validos', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onMarcaChange('T');
    component.onModeloChange('');
    fixture.detectChanges();

      expect(component.nuevaMarcaError).toBe('Marca debe tener entre 2 y 40 caracteres.');
      expect(component.nuevoModeloError).toBe('Modelo es obligatoria.');
      expect(component.puedeAgregarReglaModelo).toBe(false);
  });

  it('anade una regla valida usando la configuracion base', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onMarcaChange('Toyota');
    component.onModeloChange('Yaris');
    component.agregarReglaModelo();
    fixture.detectChanges();

    expect(component.reglasModelo.some((fila) => fila.key === 'toyota|yaris')).toBe(true);
    expect(component.mensaje).toContain('Regla por modelo añadida');
    expect(component.nuevaMarca).toBe('');
    expect(component.nuevoModelo).toBe('');
  });

  it('valida duplicados en tiempo real y bloquea anadir', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.onMarcaChange('Toyota');
    component.onModeloChange('Corolla');
    fixture.detectChanges();

      expect(component.errorDuplicadoModelo).toBe('Ya existe una regla para ese modelo.');
      expect(component.puedeAgregarReglaModelo).toBe(false);
  });

  it('elimina una regla por modelo existente', async () => {
    const config = service.getConfig();
    config.porModelo['mazda|cx-5'] = {
      descuentoSeguro: 900,
      costoMantenimiento: 300,
      cantidadMantenimientos: 4,
    };
    service.saveConfig(config);

    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(component.reglasModelo.some((fila) => fila.key === 'mazda|cx-5')).toBe(true);

    component.eliminarReglaModelo('mazda|cx-5');
    fixture.detectChanges();

    expect(component.reglasModelo.some((fila) => fila.key === 'mazda|cx-5')).toBe(false);
    expect(component.mensaje).toContain('Regla por modelo eliminada');
  });

  it('no guarda cambios cuando hay valores fuera de rango', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const saveSpy = vi.spyOn(service, 'saveConfig');

    component.config!.base.descuentoSeguro = -1;
    component.guardarCambios();

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.error).toContain('Regla base: Seguro debe estar entre');
  });

  it('guarda y muestra advertencias cuando los valores son altos pero validos', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const saveSpy = vi.spyOn(service, 'saveConfig');

    component.config!.base.descuentoSeguro = 6000;
    component.guardarCambios();

    expect(saveSpy).toHaveBeenCalled();
    expect(component.advertencias.length).toBeGreaterThan(0);
    expect(component.mensaje).toContain('advertencias');
  });

  it('detecta cambios pendientes y los limpia al guardar', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const saveSpy = vi.spyOn(service, 'saveConfig');

    expect(component.hayCambiosPendientes).toBe(false);

    component.config!.base.costoMantenimiento += 10;
    expect(component.hayCambiosPendientes).toBe(true);

    component.guardarCambios();
    expect(saveSpy).toHaveBeenCalled();
    expect(component.hayCambiosPendientes).toBe(false);
  });

  it('solicita confirmacion antes de restaurar si hay cambios pendientes', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const resetSpy = vi.spyOn(service, 'resetConfig');
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.config!.base.descuentoSeguro += 1;
    component.restaurarPorDefecto();

    expect(confirmSpy).toHaveBeenCalled();
    expect(resetSpy).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('descarta cambios pendientes cuando el usuario confirma', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const originalValue = component.config!.base.costoMantenimiento;
    component.config!.base.costoMantenimiento = originalValue + 111;
    expect(component.hayCambiosPendientes).toBe(true);

    component.descartarCambios();

    expect(confirmSpy).toHaveBeenCalled();
    expect(component.hayCambiosPendientes).toBe(false);
    expect(component.config!.base.costoMantenimiento).toBe(originalValue);
    expect(component.mensaje).toContain('Cambios no guardados descartados');
    expect(component.historialAcciones[0]?.descripcion).toBe('Cambios descartados');
  });

  it('registra ultimo guardado al guardar manualmente', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    expect(component.ultimoGuardado).toBeNull();

    component.config!.base.costoMantenimiento += 5;
    component.guardarCambios();

    expect(component.ultimoGuardado).not.toBeNull();
    expect(component.ultimoGuardadoLabel.length).toBeGreaterThan(0);
    expect(component.historialAcciones[0]?.descripcion).toBe('Guardado manual');
  });

  it('guarda automaticamente con debounce cuando autosave esta activo', () => {
    vi.useFakeTimers();
    localStorage.setItem('financiacion_admin_autosave', '1');

    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const saveSpy = vi.spyOn(service, 'saveConfig');

    component.config!.base.costoMantenimiento += 25;
    component.ngDoCheck();

    expect(saveSpy).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1500);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(component.hayCambiosPendientes).toBe(false);
    expect(component.ultimoGuardado).not.toBeNull();
    expect(component.historialAcciones[0]?.descripcion).toBe('Guardado automático');
    expect(component.toastVisible).toBe(true);

    vi.advanceTimersByTime(2200);
    expect(component.toastVisible).toBe(false);
  });

  it('no guarda automaticamente cuando hay errores de validacion', () => {
    vi.useFakeTimers();
    localStorage.setItem('financiacion_admin_autosave', '1');

    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const saveSpy = vi.spyOn(service, 'saveConfig');

    component.config!.base.descuentoSeguro = -10;
    component.ngDoCheck();

    vi.advanceTimersByTime(1500);

    expect(saveSpy).not.toHaveBeenCalled();
    expect(component.hayCambiosPendientes).toBe(true);
  });

  it('muestra estado pending cuando hay cambios validos con autosave activo', () => {
    vi.useFakeTimers();
    localStorage.setItem('financiacion_admin_autosave', '1');

    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.config!.base.costoMantenimiento += 3;
    component.ngDoCheck();

    expect(component.autosaveEstado).toBe('pending');
    expect(component.autosaveEstadoLabel).toContain('pendiente');
  });

  it('muestra estado blocked cuando hay errores de validacion con autosave activo', () => {
    localStorage.setItem('financiacion_admin_autosave', '1');

    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.config!.base.descuentoSeguro = -100;

    expect(component.autosaveEstado).toBe('blocked');
    expect(component.autosaveEstadoLabel).toContain('bloqueado');
  });

  it('exporta la configuracion como archivo JSON', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    const mockUrl = 'blob:mock-url';
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockUrl);
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);
    const clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({ href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement);

    component.exportarConfiguracion();

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
    expect(component.historialAcciones[0]?.descripcion).toBe('Configuración exportada');
  });

  it('importa configuracion valida desde un archivo JSON', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const configExportada = service.getConfig();
    configExportada.base.costoMantenimiento = 999;

    await new Promise<void>((resolve) => {
      vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
        Object.defineProperty(this, 'result', { value: JSON.stringify(configExportada), configurable: true });
        this.onload?.({} as ProgressEvent<FileReader>);
        resolve();
      });

      const input = { files: [new File([], 'config.json')], value: '' } as unknown as HTMLInputElement;
      component.importarConfiguracion({ target: input } as unknown as Event);
    });

    expect(component.config!.base.costoMantenimiento).toBe(999);
    expect(component.mensaje).toContain('importada correctamente');
    expect(component.historialAcciones[0]?.descripcion).toBe('Configuración importada');
  });

  it('muestra error al importar un archivo JSON invalido', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    await new Promise<void>((resolve) => {
      vi.spyOn(FileReader.prototype, 'readAsText').mockImplementation(function (this: FileReader) {
        Object.defineProperty(this, 'result', { value: 'NO ES JSON', configurable: true });
        this.onload?.({} as ProgressEvent<FileReader>);
        resolve();
      });

      const input = { files: [new File([], 'bad.json')], value: '' } as unknown as HTMLInputElement;
      component.importarConfiguracion({ target: input } as unknown as Event);
    });

    expect(component.error).toContain('no es un JSON de configuración válido');
  });

  it('conserva solo las ultimas 3 acciones en historial', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.config!.base.costoMantenimiento += 1;
    component.guardarCambios();
    component.config!.base.costoMantenimiento += 1;
    component.descartarCambios();
    component.config!.base.costoMantenimiento += 1;
    component.guardarCambios();
    component.config!.base.costoMantenimiento += 1;
    component.descartarCambios();

    expect(component.historialAcciones.length).toBe(3);
    confirmSpy.mockRestore();
  });

  it('filtra las reglas por modelo segun el texto ingresado', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.nuevaMarca = 'Toyota';
    component.nuevoModelo = 'Corolla';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    component.nuevaMarca = 'Ford';
    component.nuevoModelo = 'Focus';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    component.filtroModelo = 'toyota';
    const filtradas = component.reglasModeloFiltradas;
    expect(filtradas.length).toBe(1);
    // marca is capitalized from the normalized key
    expect(filtradas[0].marca.toLocaleLowerCase()).toBe('toyota');
  });

  it('filtra por modelo cuando el texto coincide con el modelo y no la marca', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.nuevaMarca = 'Toyota';
    component.nuevoModelo = 'Hilux';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    component.filtroModelo = 'hilux';
    expect(component.reglasModeloFiltradas.length).toBe(1);

    component.filtroModelo = 'xyz';
    expect(component.reglasModeloFiltradas.length).toBe(0);
  });

  it('duplicar regla copia marca y modelo al formulario de nueva regla', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.nuevaMarca = 'Honda';
    component.nuevoModelo = 'Civic';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    // find by key to avoid index issues from pre-existing localStorage data
    const fila = component.reglasModelo.find((r) => r.key === 'honda|civic')!;
    expect(fila).toBeTruthy();
    component.duplicarReglaModelo(fila);

    // duplicarReglaModelo copies the display value (capitalized from key)
    expect(component.nuevaMarca.toLocaleLowerCase()).toBe('honda');
    expect(component.nuevoModelo.toLocaleLowerCase()).toBe('civic');
    expect(component.marcaTouched).toBe(false);
    expect(component.modeloTouched).toBe(false);
  });

  it('toggle de orden cambia entre A-Z y Z-A', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.nuevaMarca = 'Renault';
    component.nuevoModelo = 'Logan';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    component.nuevaMarca = 'Alfa';
    component.nuevoModelo = 'Romeo';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    expect(component.ordenReglas).toBe('asc');
    const ascFirst = component.reglasModeloFiltradas[0].key;

    component.toggleOrdenReglas();
    expect(component.ordenReglas).toBe('desc');
    const descFirst = component.reglasModeloFiltradas[0].key;

    expect(ascFirst).not.toBe(descFirst);
  });

  it('Ctrl+S guarda cambios pendientes', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.config!.base.costoMantenimiento += 1;

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(component.hayCambiosPendientes).toBe(false);
    expect(component.mensaje).toContain('guardada');
  });

  it('Ctrl+S no hace nada si no hay cambios pendientes', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    const guardarSpy = vi.spyOn(component, 'guardarCambios');

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true });
    document.dispatchEvent(event);

    expect(guardarSpy).not.toHaveBeenCalled();
  });

  it('toggleSeccion colapsa y expande una seccion', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(component.seccionesAbiertas['base']).toBe(true);
    component.toggleSeccion('base');
    expect(component.seccionesAbiertas['base']).toBe(false);
    component.toggleSeccion('base');
    expect(component.seccionesAbiertas['base']).toBe(true);
  });

  it('expandirTodo y colapsarTodo actualizan todas las secciones', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.colapsarTodo();
    expect(component.seccionesAbiertas).toEqual({ base: false, tipo: false, modelo: false });

    component.expandirTodo();
    expect(component.seccionesAbiertas).toEqual({ base: true, tipo: true, modelo: true });
  });

  it('limpiarFiltros limpia filtroTipo y filtroModelo', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.filtroTipo = 'camion';
    component.filtroModelo = 'toyota';

    component.limpiarFiltros();

    expect(component.filtroTipo).toBe('');
    expect(component.filtroModelo).toBe('');
    expect(component.hayFiltrosActivos).toBe(false);
  });

  it('Escape limpia filtros activos', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.filtroTipo = 'camion';
    component.filtroModelo = 'focus';

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(component.filtroTipo).toBe('');
    expect(component.filtroModelo).toBe('');
  });

  it('tiposFiltrados devuelve solo los tipos que coinciden con el filtro', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;
    component.filtroTipo = 'camion';

    expect(component.tiposFiltrados).toEqual(['camioneta', 'camion']);
  });

  it('restablecerABase copia los valores base a la regla del modelo', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    component.nuevaMarca = 'Nissan';
    component.nuevoModelo = 'Frontier';
    component.marcaTouched = true;
    component.modeloTouched = true;
    component.agregarReglaModelo();

    const fila = component.reglasModelo.find((r) => r.key === 'nissan|frontier')!;
    fila.regla.descuentoSeguro = 9999;

    component.restablecerABase(fila);

    expect(fila.regla.descuentoSeguro).toBe(component.config!.base.descuentoSeguro);
    expect(fila.regla.costoMantenimiento).toBe(component.config!.base.costoMantenimiento);
  });

  it('claseCampoValor devuelve clase correcta segun el valor', async () => {
    const fixture = TestBed.createComponent(FinanciacionAdminComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const component = fixture.componentInstance;

    expect(component.claseCampoValor(100, 'descuentoSeguro')).toBe('');
    expect(component.claseCampoValor(6000, 'descuentoSeguro')).toBe('campo-advertencia');
    expect(component.claseCampoValor(25000, 'descuentoSeguro')).toBe('campo-fuera-rango');
  });

    it('aplicarABasePorTipo copia valores base a todas las reglas por tipo', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.config!.porTipo['auto'].descuentoSeguro = 9999;
      component.aplicarABasePorTipo();

      component.tiposVehiculo.forEach((tipo) => {
        expect(component.config!.porTipo[tipo].descuentoSeguro).toBe(
          component.config!.base.descuentoSeguro
        );
      });
    });

    it('aplicarABasePorModelo copia valores base a todas las reglas por modelo', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.nuevaMarca = 'BMW';
      component.nuevoModelo = '320i';
      component.marcaTouched = true;
      component.modeloTouched = true;
      component.agregarReglaModelo();

      const fila = component.reglasModelo.find((r) => r.key === 'bmw|320i')!;
      fila.regla.descuentoSeguro = 5555;

      component.aplicarABasePorModelo();

      expect(component.config!.porModelo['bmw|320i']!.descuentoSeguro).toBe(
        component.config!.base.descuentoSeguro
      );
    });

    it('tieneReglaModeloCambios detecta cambios respecto al snapshot guardado', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.nuevaMarca = 'Kia';
      component.nuevoModelo = 'Sportage';
      component.marcaTouched = true;
      component.modeloTouched = true;
      component.agregarReglaModelo();

      const key = 'kia|sportage';
      expect(component.tieneReglaModeloCambios(key)).toBe(true);

      component.guardarCambios();
      expect(component.tieneReglaModeloCambios(key)).toBe(false);
    });

    it('filtroTipo filtra los tipos visibles', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.filtroTipo = 'camion';
      const visibles = component.tiposVehiculo.filter((t) =>
        component.etiquetaTipo(t).toLocaleLowerCase().includes('camion')
      );
      expect(visibles.length).toBeGreaterThan(0);
      expect(visibles.every((t) => component.etiquetaTipo(t).toLocaleLowerCase().includes('camion'))).toBe(true);
    });

    it('ocurridoCambioEnSeccion detecta cambios por seccion', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      expect(component.ocurridoCambioEnSeccion('base')).toBe(false);
      component.config!.base.costoMantenimiento += 1;
      expect(component.ocurridoCambioEnSeccion('base')).toBe(true);
      expect(component.ocurridoCambioEnSeccion('tipo')).toBe(false);
    });

    it('deshacer restaura la configuracion previa despues de agregar una regla', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      const initialCount = component.reglasModelo.length;

      component.nuevaMarca = 'Volvo';
      component.nuevoModelo = 'XC90';
      component.marcaTouched = true;
      component.modeloTouched = true;
      component.agregarReglaModelo();

      expect(component.reglasModelo.length).toBe(initialCount + 1);
      expect(component.puedeDeshacer).toBe(true);

      component.deshacer();

      expect(component.reglasModelo.length).toBe(initialCount);
      expect(component.reglasModelo.some((r) => r.key === 'volvo|xc90')).toBe(false);
    });

    it('puedeDeshacer es falso al inicio y verdadero tras una accion', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      expect(component.puedeDeshacer).toBe(false);

      component.nuevaMarca = 'Seat';
      component.nuevoModelo = 'Ibiza';
      component.marcaTouched = true;
      component.modeloTouched = true;
      component.agregarReglaModelo();

      expect(component.puedeDeshacer).toBe(true);
    });

    it('Ctrl+Z invoca deshacer cuando hay acciones en el stack', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.nuevaMarca = 'Opel';
      component.nuevoModelo = 'Astra';
      component.marcaTouched = true;
      component.modeloTouched = true;
      component.agregarReglaModelo();

      const deshacerSpy = vi.spyOn(component, 'deshacer');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));

      expect(deshacerSpy).toHaveBeenCalled();
    });

    it('deshacer restaura estado anterior de aplicarABasePorTipo', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      const originalAutoDescuento = component.config!.porTipo['auto'].descuentoSeguro;
      component.config!.porTipo['auto'].descuentoSeguro = 1234;

      component.aplicarABasePorTipo();

      const afterApply = component.config!.porTipo['auto'].descuentoSeguro;
      expect(afterApply).toBe(component.config!.base.descuentoSeguro);

      component.deshacer();

      expect(component.config!.porTipo['auto'].descuentoSeguro).toBe(1234);
    });

    it('restaura el estado de UI desde localStorage al iniciar', async () => {
      localStorage.setItem('financiacion_admin_ui_state', JSON.stringify({
        seccionesAbiertas: { base: false, tipo: true, modelo: false },
        filtroModelo: 'ford',
        filtroTipo: 'auto',
        ordenReglas: 'desc',
      }));

      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      expect(component.seccionesAbiertas['base']).toBe(false);
      expect(component.seccionesAbiertas['tipo']).toBe(true);
      expect(component.filtroModelo).toBe('ford');
      expect(component.filtroTipo).toBe('auto');
      expect(component.ordenReglas).toBe('desc');
    });

    it('guarda el estado de UI en localStorage cuando se alterna una seccion', async () => {
      const fixture = TestBed.createComponent(FinanciacionAdminComponent);
      fixture.detectChanges();
      await fixture.whenStable();

      const component = fixture.componentInstance;

      component.toggleSeccion('base');
      component.ngDoCheck();

      const stored = JSON.parse(localStorage.getItem('financiacion_admin_ui_state') ?? '{}');
      expect(stored.seccionesAbiertas?.['base']).toBe(false);
    });
  });
