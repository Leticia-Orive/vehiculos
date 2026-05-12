import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';
import { ModalConfirmacion } from '../modal-confirmacion/modal-confirmacion';
import { AuthService } from '../auth.service';
import { CarritoService, ItemCarrito } from '../carrito.service';

type CampoOrden = 'marca' | 'modelo' | 'anio' | 'precio' | 'disponible' | 'favorito';
type VistaLista = 'tabla' | 'grid';
type FiltroRapido = 'ninguno' | 'economicos' | 'premium' | 'disponibles' | 'favoritos-disponibles';
type FiltroChip = {
  id: string;
  label: string;
  tipo: 'tipo' | 'precio' | 'caracteristicas' | 'favoritos' | 'preset';
};
type PresetPersonalizado = {
  id: string;
  nombre: string;
  filtros: Omit<EstadoPersistido, 'paginaActual' | 'itemsPorPagina'>;
};
type EstadoPersistido = {
  filtroTipo: string;
  filtroTipos: string[];
  filtroRapido: FiltroRapido;
  busqueda: string;
  precioMin: number | null;
  precioMax: number | null;
  cilindradaMin: number;
  cilindradaMax: number;
  potenciaMin: number;
  potenciaMax: number;
  soloFavoritos: boolean;
  ordenarPor: CampoOrden;
  ordenAscendente: boolean;
  vistaActual: VistaLista;
  paginaActual: number;
  itemsPorPagina: number;
  favoritosIds: number[];
  comparacionIds: number[];
};

@Component({
  selector: 'app-vehiculo-lista',
  imports: [CommonModule, RouterLink, ModalConfirmacion, FormsModule],
  templateUrl: './vehiculo-lista.html',
  styleUrl: './vehiculo-lista.scss',
})
export class VehiculoLista implements OnInit, OnDestroy {
  private readonly STORAGE_KEY = 'vehiculos.lista.estado';
  // Imagen de respaldo para evitar miniaturas rotas cuando una URL falla.
  readonly imagenPlaceholder: string =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='720' height='430' viewBox='0 0 720 430'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23edf1f5'/><stop offset='100%' stop-color='%23d7e0e9'/></linearGradient></defs><rect width='720' height='430' fill='url(%23g)'/><g fill='none' stroke='%238ea3b8' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'><rect x='145' y='115' width='430' height='200' rx='14'/><path d='M195 275l95-82 78 70 58-52 94 84'/><circle cx='495' cy='170' r='24'/></g><text x='50%' y='82%' text-anchor='middle' fill='%235f7387' font-size='28' font-family='Segoe UI, Arial, sans-serif'>Imagen no disponible</text></svg>";

  vehiculos: Vehiculo[] = [];
  filtroTipo: string = '';
  filtroRapido: FiltroRapido = 'ninguno';
  filtroTipos: string[] = [];

  // Presets personalizados
  readonly PRESETS_STORAGE_KEY = 'vehiculos.lista.presets';
  presetsPersonalizados: PresetPersonalizado[] = [];
  mostrarFormularioNuevoPreset: boolean = false;
  nuevoPresetNombre: string = '';

  // Búsqueda de texto libre
  busqueda: string = '';

  // Filtros de características (cilindrada, potencia)
  cilindradaMin: number = 0;
  cilindradaMax: number = 5000;
  potenciaMin: number = 0;
  potenciaMax: number = 500;

  // Filtro por rango de precio
  precioMin: number | null = null;
  precioMax: number | null = null;

  // Favoritos
  soloFavoritos: boolean = false;
  favoritosIds: number[] = [];

  // Comparador rápido (máx. 3 vehículos)
  readonly maxComparacion: number = 3;
  comparacionIds: number[] = [];
  mostrarPanelComparacion: boolean = false;

  // Ordenación
  ordenarPor: CampoOrden = 'marca';
  ordenAscendente: boolean = true;

  // Vista: 'tabla' o 'grid'
  vistaActual: VistaLista = 'tabla';

  // Paginación
  paginaActual: number = 1;
  itemsPorPagina: number = 8;
  readonly opcionesItemsPorPagina: number[] = [8, 12, 24];

  // Feedback visual al agregar al carrito
  mensajeAgregado: string = '';
  private idsAgregados = new Set<number>();
  private addTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private cartItems: ItemCarrito[] = [];
  private cartSub?: Subscription;

  // Toast confirmación reset
  mensajeReset: string = '';
  private timerReset: ReturnType<typeof setTimeout> | null = null;

  // Estado de carga inicial
  cargando: boolean = true;
  private cargaTimer: ReturnType<typeof setTimeout> | null = null;

  // Control del modal de confirmación
  mostrarModalConfirmacion: boolean = false;
  vehiculoAEliminar: Vehiculo | null = null;

  esAdmin: boolean = false;

  // Atajo de teclado
  private keydownHandler?: (event: KeyboardEvent) => void;
  private chipsSaliendoIds = new Set<string>();
  private chipExitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private busquedaPersistTimer: ReturnType<typeof setTimeout> | null = null;
  @ViewChild('buscadorInput') buscadorInput?: ElementRef<HTMLInputElement>;

  constructor(
    private vehiculoService: VehiculoService,
    private authService: AuthService,
    private carritoService: CarritoService,
    private titleService: Title,
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Catálogo de Vehículos');
    this.cartSub = this.carritoService.items$.subscribe((items) => {
      this.cartItems = items;
    });
    this.cartSub.add(
      this.authService.autenticado$.subscribe(() => {
        this.esAdmin = this.authService.esAdmin();
      }),
    );

    // Atajos de teclado para búsqueda y cambio rápido de vista
    this.keydownHandler = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const target = event.target as HTMLElement | null;
      const isTypingContext =
        !!target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if ((event.ctrlKey || event.metaKey) && key === 'k') {
        event.preventDefault();
        this.focusBusqueda();
        return;
      }

      if (event.altKey && !isTypingContext) {
        if (key === '1') {
          event.preventDefault();
          this.setVista('tabla');
          return;
        }
        if (key === '2') {
          event.preventDefault();
          this.setVista('grid');
          return;
        }
        if (key === 'f') {
          event.preventDefault();
          this.toggleSoloFavoritos();
          return;
        }
        if (key === 'arrowleft') {
          event.preventDefault();
          this.paginaAnterior();
          return;
        }
        if (key === 'arrowright') {
          event.preventDefault();
          this.paginaSiguiente();
          return;
        }
        if (key === 'home') {
          event.preventDefault();
          this.irAPagina(1);
          return;
        }
        if (key === 'end') {
          event.preventDefault();
          this.irAPagina(this.totalPaginas);
          return;
        }
        if (key === 'r') {
          event.preventDefault();
          this.limpiarFiltrosActivos();
          return;
        }
        if (key === 'c') {
          event.preventDefault();
          this.togglePanelComparacion();
          return;
        }
      }

      if (event.key === 'Escape' && this.busqueda.trim()) {
        this.limpiarBusqueda();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);

    this.cargando = true;
    this.cargaTimer = setTimeout(() => {
      this.vehiculos = this.vehiculoService.getVehiculos();
      this.esAdmin = this.authService.esAdmin();
      this.cargarEstadoPersistido();
      this.cargarPresetsPersonalizados();
      this.ajustarPaginaActual();
      this.cargando = false;
      this.cargaTimer = null;
    }, 400);
  }

  get vehiculosFiltrados(): Vehiculo[] {
    let resultado = this.vehiculos;

    const tiposActivos =
      this.filtroTipos.length > 0 ? this.filtroTipos : this.filtroTipo ? [this.filtroTipo] : [];
    if (tiposActivos.length > 0) {
      resultado = resultado.filter((v) => tiposActivos.includes(v.tipo));
    }

    if (this.filtroRapido === 'economicos') {
      resultado = resultado.filter((v) => v.precio <= 20000);
    } else if (this.filtroRapido === 'premium') {
      resultado = resultado.filter((v) => v.precio >= 60000);
    } else if (this.filtroRapido === 'disponibles') {
      resultado = resultado.filter((v) => v.disponible);
    } else if (this.filtroRapido === 'favoritos-disponibles') {
      resultado = resultado.filter((v) => this.esFavorito(v.id) && v.disponible);
    }

    if (this.busqueda.trim()) {
      const texto = this.busqueda.trim().toLowerCase();
      resultado = resultado.filter(
        (v) =>
          v.marca.toLowerCase().includes(texto) ||
          v.modelo.toLowerCase().includes(texto) ||
          v.color.toLowerCase().includes(texto),
      );
    }

    if (this.precioMin !== null) {
      resultado = resultado.filter((v) => v.precio >= this.precioMin!);
    }

    if (this.precioMax !== null) {
      resultado = resultado.filter((v) => v.precio <= this.precioMax!);
    }

    if (this.soloFavoritos) {
      resultado = resultado.filter((v) => this.esFavorito(v.id));
    }

    // Filtro de características (cilindrada, potencia)
    resultado = resultado.filter((v) => {
      const cilindrada = v.cilindrada ?? 0;
      const potencia = v.potencia ?? 0;
      return (
        cilindrada >= this.cilindradaMin &&
        cilindrada <= this.cilindradaMax &&
        potencia >= this.potenciaMin &&
        potencia <= this.potenciaMax
      );
    });

    return resultado.slice().sort((a, b) => {
      if (this.ordenarPor === 'favorito') {
        const cmpFavorito = Number(this.esFavorito(b.id)) - Number(this.esFavorito(a.id));
        if (cmpFavorito !== 0) {
          return this.ordenAscendente ? cmpFavorito : -cmpFavorito;
        }

        const cmpMarca = a.marca.localeCompare(b.marca);
        return this.ordenAscendente ? cmpMarca : -cmpMarca;
      }

      const valA = a[this.ordenarPor];
      const valB = b[this.ordenarPor];
      let cmp = 0;
      if (typeof valA === 'string' && typeof valB === 'string') {
        cmp = valA.localeCompare(valB);
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        cmp = Number(valA) - Number(valB);
      } else {
        cmp = (valA as number) - (valB as number);
      }
      return this.ordenAscendente ? cmp : -cmp;
    });
  }

  get vehiculosPaginados(): Vehiculo[] {
    const inicio = (this.paginaActual - 1) * this.itemsPorPagina;
    return this.vehiculosFiltrados.slice(inicio, inicio + this.itemsPorPagina);
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.vehiculosFiltrados.length / this.itemsPorPagina));
  }

  get paginaDesde(): number {
    if (this.vehiculosFiltrados.length === 0) return 0;
    return (this.paginaActual - 1) * this.itemsPorPagina + 1;
  }

  get paginaHasta(): number {
    return Math.min(this.paginaActual * this.itemsPorPagina, this.vehiculosFiltrados.length);
  }

  get filtrosActivosCount(): number {
    // Conteo centralizado para mostrar al usuario cuántos filtros están afectando el resultado.
    let total = 0;
    if (this.filtroTipo || this.filtroTipos.length > 0) total++;
    if (this.filtroRapido !== 'ninguno') total++;
    if (this.busqueda.trim()) total++;
    if (this.precioMin !== null) total++;
    if (this.precioMax !== null) total++;
    if (this.cilindradaMin !== 0 || this.cilindradaMax !== 5000) total++;
    if (this.potenciaMin !== 0 || this.potenciaMax !== 500) total++;
    if (this.soloFavoritos) total++;
    return total;
  }

  get hayFiltrosActivos(): boolean {
    return this.filtrosActivosCount > 0;
  }

  get favoritosCount(): number {
    return this.favoritosIds.length;
  }

  get filtrosChips(): FiltroChip[] {
    const chips: FiltroChip[] = [];
    if (this.filtroTipo) {
      chips.push({
        id: 'tipo',
        label: this.filtroTipo.charAt(0).toUpperCase() + this.filtroTipo.slice(1),
        tipo: 'tipo',
      });
    }
    if (this.filtroRapido !== 'ninguno') {
      const labels: Record<FiltroRapido, string> = {
        ninguno: '',
        economicos: 'Económicos',
        premium: 'Premium',
        disponibles: 'Disponibles',
        'favoritos-disponibles': '★ Favoritos Disponibles',
      };
      chips.push({ id: 'preset', label: labels[this.filtroRapido], tipo: 'preset' });
    }
    if (this.busqueda.trim()) {
      chips.push({ id: 'busqueda', label: `"${this.busqueda}"`, tipo: 'tipo' });
    }
    if (this.precioMin !== null || this.precioMax !== null) {
      const min = this.precioMin ?? '0';
      const max = this.precioMax ?? 'Sin límite';
      chips.push({ id: 'precio', label: `$${min} - $${max}`, tipo: 'precio' });
    }
    if (
      this.cilindradaMin !== 0 ||
      this.cilindradaMax !== 5000 ||
      this.potenciaMin !== 0 ||
      this.potenciaMax !== 500
    ) {
      chips.push({
        id: 'caracteristicas',
        label: `${this.cilindradaMin}-${this.cilindradaMax}cc, ${this.potenciaMin}-${this.potenciaMax}CV`,
        tipo: 'caracteristicas',
      });
    }
    if (this.soloFavoritos) {
      chips.push({ id: 'favoritos', label: 'Solo favoritos', tipo: 'favoritos' });
    }
    return chips;
  }

  get totalVehiculoTabla(): number {
    return this.vehiculosPaginados.length;
  }

  get totalVehiculoGrid(): number {
    return this.vehiculosPaginados.length;
  }

  get totalDisponiblesFiltrados(): number {
    return this.vehiculosFiltrados.filter((v) => v.disponible).length;
  }

  get totalNoDisponiblesFiltrados(): number {
    return this.vehiculosFiltrados.length - this.totalDisponiblesFiltrados;
  }

  get precioPromedioFiltrado(): number {
    if (this.vehiculosFiltrados.length === 0) {
      return 0;
    }
    const total = this.vehiculosFiltrados.reduce((acc, v) => acc + v.precio, 0);
    return Math.round(total / this.vehiculosFiltrados.length);
  }

  get paginasVisibles(): number[] {
    const total = this.totalPaginas;
    const maxBotones = 5;
    if (total <= maxBotones) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const mitad = Math.floor(maxBotones / 2);
    let inicio = this.paginaActual - mitad;
    let fin = this.paginaActual + mitad;

    if (inicio < 1) {
      inicio = 1;
      fin = maxBotones;
    }
    if (fin > total) {
      fin = total;
      inicio = total - maxBotones + 1;
    }

    return Array.from({ length: fin - inicio + 1 }, (_, i) => inicio + i);
  }

  get vehiculosComparacion(): Vehiculo[] {
    return this.comparacionIds
      .map((id) => this.vehiculos.find((v) => v.id === id))
      .filter((v): v is Vehiculo => !!v);
  }

  get puedeComparar(): boolean {
    return this.vehiculosComparacion.length >= 2;
  }

  get precioMinComparacion(): number {
    if (this.vehiculosComparacion.length === 0) {
      return 0;
    }
    return Math.min(...this.vehiculosComparacion.map((v) => v.precio));
  }

  get precioMaxComparacion(): number {
    if (this.vehiculosComparacion.length === 0) {
      return 0;
    }
    return Math.max(...this.vehiculosComparacion.map((v) => v.precio));
  }

  get deltaPrecioComparacion(): number {
    return this.precioMaxComparacion - this.precioMinComparacion;
  }

  get mejorPotenciaComparacion(): number | undefined {
    if (this.vehiculosComparacion.length === 0) {
      return undefined;
    }
    const potencias = this.vehiculosComparacion.map((v) => v.potencia ?? 0);
    return potencias.length > 0 ? Math.max(...potencias) : undefined;
  }

  get mejorCilindradaComparacion(): number | undefined {
    if (this.vehiculosComparacion.length === 0) {
      return undefined;
    }
    const cilindradas = this.vehiculosComparacion.map((v) => v.cilindrada ?? 0);
    return cilindradas.length > 0 ? Math.max(...cilindradas) : undefined;
  }

  get mejorEficienciaComparacion(): number {
    if (this.vehiculosComparacion.length === 0) {
      return 0;
    }
    const eficiencias = this.vehiculosComparacion
      .map((v) => (v.potencia ?? 1) / v.precio)
      .filter((e) => e > 0);
    return eficiencias.length > 0 ? Math.max(...eficiencias) : 0;
  }

  esVehiculoConMejorPotencia(vehiculo: Vehiculo): boolean {
    return (
      (vehiculo.potencia ?? 0) === (this.mejorPotenciaComparacion ?? 0) &&
      this.mejorPotenciaComparacion !== undefined &&
      this.mejorPotenciaComparacion > 0
    );
  }

  esVehiculoConMejorCilindrada(vehiculo: Vehiculo): boolean {
    return (
      (vehiculo.cilindrada ?? 0) === (this.mejorCilindradaComparacion ?? 0) &&
      this.mejorCilindradaComparacion !== undefined &&
      this.mejorCilindradaComparacion > 0
    );
  }

  esVehiculoConMejorEficiencia(vehiculo: Vehiculo): boolean {
    const eficiencia = (vehiculo.potencia ?? 1) / vehiculo.precio;
    return (
      this.mejorEficienciaComparacion > 0 &&
      Math.abs(eficiencia - this.mejorEficienciaComparacion) < 0.0001
    );
  }

  categoriasDesempeno(vehiculo: Vehiculo): string[] {
    const categorias: string[] = [];
    const potencia = vehiculo.potencia ?? 0;
    const cilindrada = vehiculo.cilindrada ?? 0;

    if (potencia < 100) {
      categorias.push('economico');
    } else if (potencia < 180) {
      categorias.push('normal');
    } else if (potencia < 250) {
      categorias.push('deportivo');
    } else {
      categorias.push('potente');
    }

    if (cilindrada > 2500) {
      categorias.push('alto-cc');
    }

    return categorias;
  }

  badgeDesempeno(vehiculo: Vehiculo): string {
    const potencia = vehiculo.potencia ?? 0;
    if (potencia < 100) return 'Económico';
    if (potencia < 180) return 'Normal';
    if (potencia < 250) return 'Deportivo';
    return 'Potente';
  }

  get disponiblesCount(): number {
    return this.vehiculosFiltrados.filter((v) => v.disponible).length;
  }

  get conteosPorTipo(): Partial<Record<string, number>> {
    const conteos: Partial<Record<string, number>> = {};
    this.vehiculosFiltrados.forEach((v) => {
      conteos[v.tipo] = (conteos[v.tipo] ?? 0) + 1;
    });
    return conteos;
  }

  /**
   * Obtiene el conteo de vehículos de un tipo específico.
   * Retorna 0 si el tipo no está representado.
   * @param tipo Tipo de vehículo ('auto', 'moto', 'camioneta', 'camion')
   * @returns Cantidad de vehículos del tipo especificado
   */
  getConteoTipo(tipo: string): number {
    return this.conteosPorTipo[tipo] ?? 0;
  }

  // Mensaje dinámico según los filtros aplicados
  get mensajeEstadoVacio(): string {
    if (this.busqueda) {
      return `No se encontraron vehículos que coincidan con "${this.busqueda}"`;
    }
    if (this.filtroRapido === 'economicos') {
      return 'No se encontraron vehículos en el segmento Económicos';
    }
    if (this.filtroRapido === 'premium') {
      return 'No se encontraron vehículos en el segmento Premium';
    }
    if (this.filtroRapido === 'disponibles') {
      return 'No hay vehículos disponibles en este momento';
    }
    if (this.filtroRapido === 'favoritos-disponibles') {
      if (this.favoritosCount === 0) {
        return 'No tienes favoritos guardados';
      }
      return 'Ninguno de tus favoritos está disponible en este momento';
    }
    if (this.filtroTipo) {
      return `No hay ${this.filtroTipo}s disponibles con los filtros aplicados`;
    }
    if (this.soloFavoritos) {
      return 'No tienes favoritos guardados';
    }
    if (this.precioMin !== null || this.precioMax !== null) {
      return 'No se encontraron vehículos en el rango de precio seleccionado';
    }
    if (
      this.cilindradaMin !== 0 ||
      this.cilindradaMax !== 5000 ||
      this.potenciaMin !== 0 ||
      this.potenciaMax !== 500
    ) {
      return 'No se encontraron vehículos con las características especificadas';
    }
    return 'No hay vehículos disponibles';
  }

  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    this.paginaActual = 1;
    if (this.busquedaPersistTimer) {
      clearTimeout(this.busquedaPersistTimer);
    }
    this.busquedaPersistTimer = setTimeout(() => {
      this.guardarEstado();
      this.busquedaPersistTimer = null;
    }, 220);
  }

  onPrecioMinChange(valor: string): void {
    this.precioMin = this.parsePrecio(valor);
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onPrecioMaxChange(valor: string): void {
    this.precioMax = this.parsePrecio(valor);
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onCilindradaMinChange(valor: number): void {
    this.cilindradaMin = valor;
    // Si el mínimo supera al máximo, se corrige automáticamente para mantener un rango válido.
    if (this.cilindradaMin > this.cilindradaMax) {
      this.cilindradaMax = this.cilindradaMin;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onCilindradaMaxChange(valor: number): void {
    this.cilindradaMax = valor;
    // Si el máximo queda por debajo del mínimo, se reajusta para evitar estado inválido.
    if (this.cilindradaMax < this.cilindradaMin) {
      this.cilindradaMin = this.cilindradaMax;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onPotenciaMinChange(valor: number): void {
    this.potenciaMin = valor;
    // Se mantiene coherencia min/max para que el filtro siempre sea aplicable.
    if (this.potenciaMin > this.potenciaMax) {
      this.potenciaMax = this.potenciaMin;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onPotenciaMaxChange(valor: number): void {
    this.potenciaMax = valor;
    // Se mantiene coherencia min/max para que el filtro siempre sea aplicable.
    if (this.potenciaMax < this.potenciaMin) {
      this.potenciaMin = this.potenciaMax;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  limpiarBusqueda(): void {
    if (this.busquedaPersistTimer) {
      clearTimeout(this.busquedaPersistTimer);
      this.busquedaPersistTimer = null;
    }
    this.busqueda = '';
    this.paginaActual = 1;
    this.guardarEstado();
  }

  focusBusqueda(): void {
    this.buscadorInput?.nativeElement.focus();
    this.buscadorInput?.nativeElement.select();
  }

  toggleFiltroTipo(tipo: string): void {
    if (this.filtroTipos.includes(tipo)) {
      this.filtroTipos = this.filtroTipos.filter((t) => t !== tipo);
    } else {
      this.filtroTipos = [...this.filtroTipos, tipo];
    }
    this.filtroTipo = '';
    this.paginaActual = 1;
    this.guardarEstado();
  }

  esFiltroTipoSeleccionado(tipo: string): boolean {
    return this.filtroTipos.includes(tipo);
  }

  guardarPresetPersonalizado(): void {
    if (!this.nuevoPresetNombre.trim()) return;

    const id = `preset-${Date.now()}`;
    const preset: PresetPersonalizado = {
      id,
      nombre: this.nuevoPresetNombre.trim(),
      filtros: {
        filtroTipo: this.filtroTipo,
        filtroTipos: [...this.filtroTipos],
        filtroRapido: this.filtroRapido,
        busqueda: this.busqueda,
        precioMin: this.precioMin,
        precioMax: this.precioMax,
        cilindradaMin: this.cilindradaMin,
        cilindradaMax: this.cilindradaMax,
        potenciaMin: this.potenciaMin,
        potenciaMax: this.potenciaMax,
        soloFavoritos: this.soloFavoritos,
        ordenarPor: this.ordenarPor,
        ordenAscendente: this.ordenAscendente,
        vistaActual: this.vistaActual,
        favoritosIds: [...this.favoritosIds],
        comparacionIds: [...this.comparacionIds],
      },
    };

    this.presetsPersonalizados = [...this.presetsPersonalizados, preset];
    this.guardarPresetsPersonalizados();
    this.nuevoPresetNombre = '';
    this.mostrarFormularioNuevoPreset = false;

    this.mensajeReset = `✔ Preset "${preset.nombre}" guardado`;
    if (this.timerReset) clearTimeout(this.timerReset);
    this.timerReset = setTimeout(() => {
      this.mensajeReset = '';
      this.timerReset = null;
    }, 2500);
  }

  aplicarPresetPersonalizado(preset: PresetPersonalizado): void {
    this.filtroTipo = preset.filtros.filtroTipo;
    this.filtroTipos = preset.filtros.filtroTipos || [];
    this.filtroRapido = preset.filtros.filtroRapido;
    this.busqueda = preset.filtros.busqueda;
    this.precioMin = preset.filtros.precioMin;
    this.precioMax = preset.filtros.precioMax;
    this.cilindradaMin = preset.filtros.cilindradaMin;
    this.cilindradaMax = preset.filtros.cilindradaMax;
    this.potenciaMin = preset.filtros.potenciaMin;
    this.potenciaMax = preset.filtros.potenciaMax;
    this.soloFavoritos = preset.filtros.soloFavoritos;
    this.ordenarPor = preset.filtros.ordenarPor;
    this.ordenAscendente = preset.filtros.ordenAscendente;
    this.vistaActual = preset.filtros.vistaActual;
    this.favoritosIds = preset.filtros.favoritosIds || [];
    this.comparacionIds = (preset.filtros.comparacionIds || []).slice(0, this.maxComparacion);
    this.mostrarPanelComparacion = this.comparacionIds.length >= 2;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  esPresetActivo(preset: PresetPersonalizado): boolean {
    const p = preset.filtros;
    const tiposPreset = [...(p.filtroTipos || [])].sort();
    const tiposActual = [...this.filtroTipos].sort();
    const favPreset = [...(p.favoritosIds || [])].sort((a, b) => a - b);
    const favActual = [...this.favoritosIds].sort((a, b) => a - b);
    const compPreset = [...(p.comparacionIds || [])].sort((a, b) => a - b);
    const compActual = [...this.comparacionIds].sort((a, b) => a - b);

    return (
      p.filtroTipo === this.filtroTipo &&
      JSON.stringify(tiposPreset) === JSON.stringify(tiposActual) &&
      p.filtroRapido === this.filtroRapido &&
      p.busqueda === this.busqueda &&
      p.precioMin === this.precioMin &&
      p.precioMax === this.precioMax &&
      p.cilindradaMin === this.cilindradaMin &&
      p.cilindradaMax === this.cilindradaMax &&
      p.potenciaMin === this.potenciaMin &&
      p.potenciaMax === this.potenciaMax &&
      p.soloFavoritos === this.soloFavoritos &&
      p.ordenarPor === this.ordenarPor &&
      p.ordenAscendente === this.ordenAscendente &&
      p.vistaActual === this.vistaActual &&
      JSON.stringify(favPreset) === JSON.stringify(favActual) &&
      JSON.stringify(compPreset) === JSON.stringify(compActual)
    );
  }

  eliminarPresetPersonalizado(id: string): void {
    this.presetsPersonalizados = this.presetsPersonalizados.filter((p) => p.id !== id);
    this.guardarPresetsPersonalizados();
  }

  private guardarPresetsPersonalizados(): void {
    localStorage.setItem(this.PRESETS_STORAGE_KEY, JSON.stringify(this.presetsPersonalizados));
  }

  private cargarPresetsPersonalizados(): void {
    const raw = localStorage.getItem(this.PRESETS_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.presetsPersonalizados = parsed as PresetPersonalizado[];
      }
    } catch {
      this.presetsPersonalizados = [];
    }
  }

  exportarACSV(soloPaginaActual: boolean = false): void {
    const data = soloPaginaActual ? this.vehiculosPaginados : this.vehiculosFiltrados;
    const headers = [
      'ID',
      'Marca',
      'Modelo',
      'Año',
      'Tipo',
      'Precio',
      'Color',
      'Disponible',
      'Cilindrada',
      'Potencia',
    ];
    const rows = data.map((v) => [
      v.id,
      v.marca,
      v.modelo,
      v.anio,
      v.tipo,
      v.precio,
      v.color,
      v.disponible ? 'Sí' : 'No',
      v.cilindrada ?? '',
      v.potencia ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => this.escapeCsvCell(cell)).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const sufijo = soloPaginaActual ? 'pagina-actual' : 'filtrados';
    link.setAttribute(
      'download',
      `vehiculos-${sufijo}-${new Date().toISOString().split('T')[0]}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportarComparacionCSV(): void {
    if (this.vehiculosComparacion.length === 0) {
      return;
    }

    const headers = [
      'ID',
      'Marca',
      'Modelo',
      'Año',
      'Tipo',
      'Precio',
      'Color',
      'Disponible',
      'Cilindrada',
      'Potencia',
    ];
    const rows = this.vehiculosComparacion.map((v) => [
      v.id,
      v.marca,
      v.modelo,
      v.anio,
      v.tipo,
      v.precio,
      v.color,
      v.disponible ? 'Sí' : 'No',
      v.cilindrada ?? '',
      v.potencia ?? '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => this.escapeCsvCell(cell)).join(',')),
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `vehiculos-comparacion-${new Date().toISOString().split('T')[0]}.csv`,
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  copiarComparacionAlPortapapeles(): void {
    if (this.vehiculosComparacion.length === 0) {
      return;
    }

    const encabezados = ['Marca/Modelo', 'Precio', 'Año', 'Potencia', 'Cilindrada', 'Eficiencia'];
    const filas = this.vehiculosComparacion.map((v) => [
      `${v.marca} ${v.modelo}`,
      `$${v.precio}`,
      String(v.anio),
      `${v.potencia ?? '-'} CV`,
      `${v.cilindrada ?? '-'} cc`,
      `${((v.potencia ?? 1) / v.precio).toFixed(4)}`,
    ]);

    const texto = [
      `COMPARACIÓN DE VEHÍCULOS - ${new Date().toLocaleDateString('es-AR')}`,
      `Delta de precio: $${this.deltaPrecioComparacion}`,
      '',
      [encabezados.join(' | '), filas.map((f) => f.join(' | '))].flat().join('\n'),
    ].join('\n');

    navigator.clipboard
      .writeText(texto)
      .then(() => {
        this.mensajeReset = '✔ Comparación copiada al portapapeles';
        if (this.timerReset) clearTimeout(this.timerReset);
        this.timerReset = setTimeout(() => {
          this.mensajeReset = '';
          this.timerReset = null;
        }, 2000);
      })
      .catch(() => {
        this.mensajeReset = '⚠ Error al copiar al portapapeles';
        if (this.timerReset) clearTimeout(this.timerReset);
        this.timerReset = setTimeout(() => {
          this.mensajeReset = '';
          this.timerReset = null;
        }, 2000);
      });
  }

  limpiarFiltrosPrecio(): void {
    this.precioMin = null;
    this.precioMax = null;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  limpiarFiltrosCaracteristicas(): void {
    this.cilindradaMin = 0;
    this.cilindradaMax = 5000;
    this.potenciaMin = 0;
    this.potenciaMax = 500;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  limpiarFiltrosActivos(): void {
    // Limpieza rápida de filtros de búsqueda sin resetear preferencias de vista/orden globales.
    this.filtroTipo = '';
    this.filtroRapido = 'ninguno';
    this.busqueda = '';
    this.precioMin = null;
    this.precioMax = null;
    this.cilindradaMin = 0;
    this.cilindradaMax = 5000;
    this.potenciaMin = 0;
    this.potenciaMax = 500;
    this.soloFavoritos = false;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  ordenar(campo: CampoOrden): void {
    if (this.ordenarPor === campo) {
      this.ordenAscendente = !this.ordenAscendente;
    } else {
      this.ordenarPor = campo;
      this.ordenAscendente = true;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onOrdenCampoChange(campo: CampoOrden): void {
    this.ordenarPor = campo;
    if (campo === 'favorito') {
      this.ordenAscendente = true;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  toggleDireccionOrden(): void {
    this.ordenAscendente = !this.ordenAscendente;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  iconoOrden(campo: CampoOrden): string {
    if (this.ordenarPor !== campo) return '↕';
    return this.ordenAscendente ? '↑' : '↓';
  }

  resetearPreferencias(): void {
    this.filtroTipo = '';
    this.filtroRapido = 'ninguno';
    this.busqueda = '';
    this.precioMin = null;
    this.precioMax = null;
    this.cilindradaMin = 0;
    this.cilindradaMax = 5000;
    this.potenciaMin = 0;
    this.potenciaMax = 500;
    this.soloFavoritos = false;
    this.favoritosIds = [];
    this.comparacionIds = [];
    this.mostrarPanelComparacion = false;
    this.ordenarPor = 'marca';
    this.ordenAscendente = true;
    this.vistaActual = 'tabla';
    this.paginaActual = 1;
    this.itemsPorPagina = 8;
    this.mensajeAgregado = '';
    localStorage.removeItem(this.STORAGE_KEY);

    if (this.timerReset) clearTimeout(this.timerReset);
    this.mensajeReset = '✔ Preferencias restablecidas';
    this.timerReset = setTimeout(() => {
      this.mensajeReset = '';
      this.timerReset = null;
    }, 2500);
  }

  setVista(vista: VistaLista): void {
    this.vistaActual = vista;
    this.guardarEstado();
  }

  setItemsPorPagina(valor: number): void {
    if (!this.opcionesItemsPorPagina.includes(valor)) return;
    this.itemsPorPagina = valor;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  toggleSoloFavoritos(): void {
    this.soloFavoritos = !this.soloFavoritos;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  /**
   * Alterna el estado de favorito de un vehículo.
   * Si está en favoritos, lo quita; si no está, lo agrega.
   * Persiste el cambio en localStorage.
   * @param idVehiculo ID del vehículo a alternar
   */
  toggleFavorito(idVehiculo: number): void {
    if (this.esFavorito(idVehiculo)) {
      this.favoritosIds = this.favoritosIds.filter((id) => id !== idVehiculo);
    } else {
      this.favoritosIds = [...this.favoritosIds, idVehiculo];
    }

    this.paginaActual = 1;
    this.guardarEstado();
  }

  /**
   * Alterna la inclusión de un vehículo en el comparador rápido.
   * Máximo 3 vehículos pueden compararse simultáneamente.
   * Oculta el panel si quedan menos de 2 vehículos.
   * @param idVehiculo ID del vehículo a agregar/quitar de la comparación
   */
  toggleComparacion(idVehiculo: number): void {
    if (this.estaEnComparacion(idVehiculo)) {
      this.comparacionIds = this.comparacionIds.filter((id) => id !== idVehiculo);
      if (this.comparacionIds.length < 2) {
        this.mostrarPanelComparacion = false;
      }
      this.guardarEstado();
      return;
    }

    if (this.comparacionIds.length >= this.maxComparacion) {
      this.mensajeReset = `Máximo ${this.maxComparacion} vehículos en comparación`;
      if (this.timerReset) clearTimeout(this.timerReset);
      this.timerReset = setTimeout(() => {
        this.mensajeReset = '';
        this.timerReset = null;
      }, 2200);
      return;
    }

    this.comparacionIds = [...this.comparacionIds, idVehiculo];
    if (this.comparacionIds.length >= 2) {
      this.mostrarPanelComparacion = true;
    }
    this.guardarEstado();
  }

  estaEnComparacion(idVehiculo: number): boolean {
    return this.comparacionIds.includes(idVehiculo);
  }

  quitarDeComparacion(idVehiculo: number): void {
    this.comparacionIds = this.comparacionIds.filter((id) => id !== idVehiculo);
    if (this.comparacionIds.length < 2) {
      this.mostrarPanelComparacion = false;
    }
    this.guardarEstado();
  }

  limpiarComparacion(): void {
    this.comparacionIds = [];
    this.mostrarPanelComparacion = false;
    this.guardarEstado();
  }

  togglePanelComparacion(): void {
    if (!this.puedeComparar) {
      this.mostrarPanelComparacion = false;
      this.guardarEstado();
      return;
    }
    this.mostrarPanelComparacion = !this.mostrarPanelComparacion;
    this.guardarEstado();
  }

  /**
   * Verifica si un vehículo está marcado como favorito.
   * @param idVehiculo ID del vehículo a verificar
   * @returns true si el vehículo está en la lista de favoritos
   */
  esFavorito(idVehiculo: number): boolean {
    return this.favoritosIds.includes(idVehiculo);
  }

  irAPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.guardarEstado();
  }

  paginaAnterior(): void {
    this.irAPagina(this.paginaActual - 1);
  }

  paginaSiguiente(): void {
    this.irAPagina(this.paginaActual + 1);
  }

  // Limpia todos los filtros activos y restaura los valores por defecto
  limpiarTodosFiltros(): void {
    this.filtroTipo = '';
    this.filtroRapido = 'ninguno';
    this.busqueda = '';
    this.precioMin = null;
    this.precioMax = null;
    this.cilindradaMin = 0;
    this.cilindradaMax = 5000;
    this.potenciaMin = 0;
    this.potenciaMax = 500;
    this.soloFavoritos = false;
    this.ordenarPor = 'marca';
    this.ordenAscendente = true;
    this.paginaActual = 1;
    this.guardarEstado();

    // Mostrar feedback visual
    this.mensajeReset = 'Filtros restablecidos';
    if (this.timerReset) clearTimeout(this.timerReset);
    this.timerReset = setTimeout(() => {
      this.mensajeReset = '';
      this.timerReset = null;
    }, 2000);
  }

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    if (this.cargaTimer) {
      clearTimeout(this.cargaTimer);
      this.cargaTimer = null;
    }
    // Se limpian timers activos para evitar fugas al salir de la vista.
    this.addTimers.forEach((t) => clearTimeout(t));
    if (this.timerReset) {
      clearTimeout(this.timerReset);
      this.timerReset = null;
    }
    if (this.busquedaPersistTimer) {
      clearTimeout(this.busquedaPersistTimer);
      this.busquedaPersistTimer = null;
    }
    this.chipExitTimers.forEach((t) => clearTimeout(t));
    this.chipExitTimers.clear();
    this.chipsSaliendoIds.clear();
    // Limpieza de event listeners
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
    }
  }

  onImagenError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.imagenPlaceholder) {
      return;
    }
    // Sustituye una imagen fallida por placeholder y corta reintentos.
    img.src = this.imagenPlaceholder;
  }

  esRecienAgregado(id: number): boolean {
    return this.idsAgregados.has(id);
  }

  cantidadEnCarrito(id: number): number {
    return this.cartItems.find((i) => i.vehiculo.id === id)?.cantidad ?? 0;
  }

  /**
   * Agrega un vehículo al carrito y muestra feedback visual.
   * El estado de "recién agregado" persiste 1.6 segundos.
   * @param vehiculo Objeto Vehiculo a agregar
   */
  agregarAlCarrito(vehiculo: Vehiculo): void {
    this.carritoService.agregar(vehiculo);
    this.idsAgregados.add(vehiculo.id);
    const prev = this.addTimers.get(vehiculo.id);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      this.idsAgregados.delete(vehiculo.id);
      this.addTimers.delete(vehiculo.id);
    }, 1600);
    this.addTimers.set(vehiculo.id, t);
  }

  // Abre el modal de confirmación sin eliminar aún
  eliminar(id: number): void {
    this.vehiculoAEliminar = this.vehiculos.find((v) => v.id === id) || null;
    this.mostrarModalConfirmacion = true;
  }

  // Ejecuta la eliminación después de la confirmación
  confirmarEliminacion(): void {
    if (this.vehiculoAEliminar) {
      this.vehiculoService.eliminarVehiculo(this.vehiculoAEliminar.id);
      this.vehiculos = this.vehiculoService.getVehiculos();
      this.ajustarPaginaActual();
      this.guardarEstado();
      this.cerrarModal();
    }
  }

  // Cierra el modal sin hacer nada
  cancelarEliminacion(): void {
    this.cerrarModal();
  }

  // Limpia el estado del modal
  private cerrarModal(): void {
    this.mostrarModalConfirmacion = false;
    this.vehiculoAEliminar = null;
  }

  setFiltro(tipo: string): void {
    this.filtroTipo = tipo;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  setFiltroRapido(filtro: FiltroRapido): void {
    this.filtroRapido = filtro;
    this.paginaActual = 1;
    this.guardarEstado();
  }

  esChipSaliendo(chipId: string): boolean {
    return this.chipsSaliendoIds.has(chipId);
  }

  removerFiltroChipConAnimacion(chipId: string): void {
    if (this.chipsSaliendoIds.has(chipId)) {
      return;
    }
    this.chipsSaliendoIds.add(chipId);
    const t = setTimeout(() => {
      this.removerFiltroChip(chipId);
      this.chipsSaliendoIds.delete(chipId);
      this.chipExitTimers.delete(chipId);
    }, 180);
    this.chipExitTimers.set(chipId, t);
  }

  removerFiltroChip(chipId: string): void {
    switch (chipId) {
      case 'tipo':
        this.filtroTipo = '';
        break;
      case 'preset':
        this.filtroRapido = 'ninguno';
        break;
      case 'busqueda':
        this.busqueda = '';
        break;
      case 'precio':
        this.precioMin = null;
        this.precioMax = null;
        break;
      case 'caracteristicas':
        this.cilindradaMin = 0;
        this.cilindradaMax = 5000;
        this.potenciaMin = 0;
        this.potenciaMax = 500;
        break;
      case 'favoritos':
        this.soloFavoritos = false;
        break;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  private ajustarPaginaActual(): void {
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = this.totalPaginas;
    }
    if (this.paginaActual < 1) {
      this.paginaActual = 1;
    }
  }

  guardarEstado(): void {
    // Persistencia completa de filtros/preferencias para mantener continuidad entre recargas.
    const estado: EstadoPersistido = {
      filtroTipo: this.filtroTipo,
      filtroTipos: this.filtroTipos,
      filtroRapido: this.filtroRapido,
      busqueda: this.busqueda,
      precioMin: this.precioMin,
      precioMax: this.precioMax,
      cilindradaMin: this.cilindradaMin,
      cilindradaMax: this.cilindradaMax,
      potenciaMin: this.potenciaMin,
      potenciaMax: this.potenciaMax,
      soloFavoritos: this.soloFavoritos,
      ordenarPor: this.ordenarPor,
      ordenAscendente: this.ordenAscendente,
      vistaActual: this.vistaActual,
      paginaActual: this.paginaActual,
      itemsPorPagina: this.itemsPorPagina,
      favoritosIds: this.favoritosIds,
      comparacionIds: this.comparacionIds,
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(estado));
  }

  private cargarEstadoPersistido(): void {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return;
    }

    const estado = this.parseEstadoPersistido(raw);
    if (!estado) {
      localStorage.removeItem(this.STORAGE_KEY);
      return;
    }

    if (typeof estado['filtroTipo'] === 'string') {
      this.filtroTipo = estado['filtroTipo'];
    }
    if (Array.isArray(estado['filtroTipos'])) {
      this.filtroTipos = estado['filtroTipos'].filter((t): t is string => typeof t === 'string');
    }
    if (this.esFiltroRapidoValido(estado['filtroRapido'])) {
      this.filtroRapido = estado['filtroRapido'];
    }
    if (typeof estado['busqueda'] === 'string') {
      this.busqueda = estado['busqueda'];
    }
    if (typeof estado['precioMin'] === 'number' || estado['precioMin'] === null) {
      this.precioMin = estado['precioMin'];
    }
    if (typeof estado['precioMax'] === 'number' || estado['precioMax'] === null) {
      this.precioMax = estado['precioMax'];
    }
    this.cilindradaMin = this.parseRangoNumero(
      estado['cilindradaMin'],
      0,
      5000,
      this.cilindradaMin,
    );
    this.cilindradaMax = this.parseRangoNumero(
      estado['cilindradaMax'],
      0,
      5000,
      this.cilindradaMax,
    );
    this.potenciaMin = this.parseRangoNumero(estado['potenciaMin'], 0, 500, this.potenciaMin);
    this.potenciaMax = this.parseRangoNumero(estado['potenciaMax'], 0, 500, this.potenciaMax);

    if (typeof estado['soloFavoritos'] === 'boolean') {
      this.soloFavoritos = estado['soloFavoritos'];
    }
    if (this.esCampoOrdenValido(estado['ordenarPor'])) {
      this.ordenarPor = estado['ordenarPor'];
    }
    if (typeof estado['ordenAscendente'] === 'boolean') {
      this.ordenAscendente = estado['ordenAscendente'];
    }
    if (this.esVistaValida(estado['vistaActual'])) {
      this.vistaActual = estado['vistaActual'];
    }
    if (typeof estado['paginaActual'] === 'number') {
      this.paginaActual = this.parseRangoNumero(estado['paginaActual'], 1, 9999, this.paginaActual);
    }
    if (this.esItemsPorPaginaValido(estado['itemsPorPagina'])) {
      this.itemsPorPagina = estado['itemsPorPagina'];
    }
    if (Array.isArray(estado['favoritosIds'])) {
      this.favoritosIds = estado['favoritosIds'].filter(
        (id): id is number => typeof id === 'number',
      );
    }
    if (Array.isArray(estado['comparacionIds'])) {
      this.comparacionIds = estado['comparacionIds'].filter(
        (id): id is number => typeof id === 'number',
      );
      this.comparacionIds = this.comparacionIds.slice(0, this.maxComparacion);
      this.mostrarPanelComparacion = this.comparacionIds.length >= 2;
    }

    this.normalizarRangosCaracteristicas();
  }

  private parseEstadoPersistido(raw: string): Record<string, unknown> | null {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  private esCampoOrdenValido(valor: unknown): valor is CampoOrden {
    return (
      valor === 'marca' ||
      valor === 'modelo' ||
      valor === 'anio' ||
      valor === 'precio' ||
      valor === 'disponible' ||
      valor === 'favorito'
    );
  }

  private esFiltroRapidoValido(valor: unknown): valor is FiltroRapido {
    return (
      valor === 'ninguno' ||
      valor === 'economicos' ||
      valor === 'premium' ||
      valor === 'disponibles' ||
      valor === 'favoritos-disponibles'
    );
  }

  private esVistaValida(valor: unknown): valor is VistaLista {
    return valor === 'tabla' || valor === 'grid';
  }

  private esItemsPorPaginaValido(valor: unknown): valor is number {
    return typeof valor === 'number' && this.opcionesItemsPorPagina.includes(valor);
  }

  private parseRangoNumero(valor: unknown, min: number, max: number, fallback: number): number {
    if (typeof valor !== 'number' || Number.isNaN(valor)) {
      return fallback;
    }
    if (valor < min) {
      return min;
    }
    if (valor > max) {
      return max;
    }
    return valor;
  }

  private normalizarRangosCaracteristicas(): void {
    if (this.cilindradaMin > this.cilindradaMax) {
      const swap = this.cilindradaMin;
      this.cilindradaMin = this.cilindradaMax;
      this.cilindradaMax = swap;
    }

    if (this.potenciaMin > this.potenciaMax) {
      const swap = this.potenciaMin;
      this.potenciaMin = this.potenciaMax;
      this.potenciaMax = swap;
    }
  }

  private parsePrecio(valor: string): number | null {
    if (!valor.trim()) return null;
    const numero = Number(valor);
    if (Number.isNaN(numero) || numero < 0) return null;
    return numero;
  }

  private escapeCsvCell(valor: unknown): string {
    const normalizado = String(valor ?? '').replace(/"/g, '""');
    return `"${normalizado}"`;
  }
}
