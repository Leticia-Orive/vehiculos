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

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const addButton = Array.from(buttons)
      .find((button) => button.textContent?.includes('Añadir regla')) as HTMLButtonElement;

    expect(component.nuevaMarcaError).toBe('Marca debe tener entre 2 y 40 caracteres.');
    expect(component.nuevoModeloError).toBe('Modelo es obligatoria.');
    expect(addButton.disabled).toBe(true);
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

    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    const addButton = Array.from(buttons)
      .find((button) => button.textContent?.includes('Añadir regla')) as HTMLButtonElement;

    expect(component.errorDuplicadoModelo).toBe('Ya existe una regla para ese modelo.');
    expect(addButton.disabled).toBe(true);
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
});
