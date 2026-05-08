import { Component, OnDestroy, OnInit } from '@angular/core';
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

type CampoOrden = 'marca' | 'modelo' | 'anio' | 'precio' | 'disponible';
type VistaLista = 'tabla' | 'grid';
type EstadoPersistido = {
  filtroTipo: string;
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
};

@Component({
  selector: 'app-vehiculo-lista',
  imports: [CommonModule, RouterLink, ModalConfirmacion, FormsModule],
  templateUrl: './vehiculo-lista.html',
  styleUrl: './vehiculo-lista.scss',
})
export class VehiculoLista implements OnInit, OnDestroy {
  private readonly STORAGE_KEY = 'vehiculos.lista.estado';
  readonly imagenPlaceholder: string =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='720' height='430' viewBox='0 0 720 430'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23edf1f5'/><stop offset='100%' stop-color='%23d7e0e9'/></linearGradient></defs><rect width='720' height='430' fill='url(%23g)'/><g fill='none' stroke='%238ea3b8' stroke-width='9' stroke-linecap='round' stroke-linejoin='round'><rect x='145' y='115' width='430' height='200' rx='14'/><path d='M195 275l95-82 78 70 58-52 94 84'/><circle cx='495' cy='170' r='24'/></g><text x='50%' y='82%' text-anchor='middle' fill='%235f7387' font-size='28' font-family='Segoe UI, Arial, sans-serif'>Imagen no disponible</text></svg>";

  vehiculos: Vehiculo[] = [];
  filtroTipo: string = '';

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

  // Control del modal de confirmación
  mostrarModalConfirmacion: boolean = false;
  vehiculoAEliminar: Vehiculo | null = null;

  esAdmin: boolean = false;

  constructor(
    private vehiculoService: VehiculoService,
    private authService: AuthService,
    private carritoService: CarritoService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Catálogo de Vehículos');
    this.cartSub = this.carritoService.items$.subscribe(items => {
      this.cartItems = items;
    });
    this.cargando = true;
    setTimeout(() => {
      this.vehiculos = this.vehiculoService.getVehiculos();
      this.esAdmin = this.authService.esAdmin();
      this.cargarEstadoPersistido();
      this.ajustarPaginaActual();
      this.cargando = false;
    }, 400);
  }

  get vehiculosFiltrados(): Vehiculo[] {
    let resultado = this.vehiculos;

    if (this.filtroTipo) {
      resultado = resultado.filter(v => v.tipo === this.filtroTipo);
    }

    if (this.busqueda.trim()) {
      const texto = this.busqueda.trim().toLowerCase();
      resultado = resultado.filter(v =>
        v.marca.toLowerCase().includes(texto) ||
        v.modelo.toLowerCase().includes(texto) ||
        v.color.toLowerCase().includes(texto)
      );
    }

    if (this.precioMin !== null) {
      resultado = resultado.filter(v => v.precio >= this.precioMin!);
    }

    if (this.precioMax !== null) {
      resultado = resultado.filter(v => v.precio <= this.precioMax!);
    }

    if (this.soloFavoritos) {
      resultado = resultado.filter(v => this.esFavorito(v.id));
    }

    // Filtro de características (cilindrada, potencia)
    resultado = resultado.filter(v => {
      const cilindrada = (v as any).cilindrada || 0;
      const potencia = (v as any).potencia || 0;
      return cilindrada >= this.cilindradaMin && cilindrada <= this.cilindradaMax &&
             potencia >= this.potenciaMin && potencia <= this.potenciaMax;
    });

    return resultado.slice().sort((a, b) => {
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
    let total = 0;
    if (this.filtroTipo) total++;
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

  onBusquedaChange(valor: string): void {
    this.busqueda = valor;
    this.paginaActual = 1;
    this.guardarEstado();
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
    if (this.cilindradaMin > this.cilindradaMax) {
      this.cilindradaMax = this.cilindradaMin;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onCilindradaMaxChange(valor: number): void {
    this.cilindradaMax = valor;
    if (this.cilindradaMax < this.cilindradaMin) {
      this.cilindradaMin = this.cilindradaMax;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onPotenciaMinChange(valor: number): void {
    this.potenciaMin = valor;
    if (this.potenciaMin > this.potenciaMax) {
      this.potenciaMax = this.potenciaMin;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  onPotenciaMaxChange(valor: number): void {
    this.potenciaMax = valor;
    if (this.potenciaMax < this.potenciaMin) {
      this.potenciaMin = this.potenciaMax;
    }
    this.paginaActual = 1;
    this.guardarEstado();
  }

  limpiarBusqueda(): void {
    this.busqueda = '';
    this.paginaActual = 1;
    this.guardarEstado();
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
    this.filtroTipo = '';
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

  iconoOrden(campo: CampoOrden): string {
    if (this.ordenarPor !== campo) return '↕';
    return this.ordenAscendente ? '↑' : '↓';
  }

  resetearPreferencias(): void {
    this.filtroTipo = '';
    this.busqueda = '';
    this.precioMin = null;
    this.precioMax = null;
    this.cilindradaMin = 0;
    this.cilindradaMax = 5000;
    this.potenciaMin = 0;
    this.potenciaMax = 500;
    this.soloFavoritos = false;
    this.favoritosIds = [];
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

  toggleFavorito(idVehiculo: number): void {
    if (this.esFavorito(idVehiculo)) {
      this.favoritosIds = this.favoritosIds.filter(id => id !== idVehiculo);
    } else {
      this.favoritosIds = [...this.favoritosIds, idVehiculo];
    }

    this.paginaActual = 1;
    this.guardarEstado();
  }

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

  ngOnDestroy(): void {
    this.cartSub?.unsubscribe();
    this.addTimers.forEach(t => clearTimeout(t));
    if (this.timerReset) {
      clearTimeout(this.timerReset);
      this.timerReset = null;
    }
  }

  onImagenError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.imagenPlaceholder) {
      return;
    }
    img.src = this.imagenPlaceholder;
  }

  esRecienAgregado(id: number): boolean {
    return this.idsAgregados.has(id);
  }

  cantidadEnCarrito(id: number): number {
    return this.cartItems.find(i => i.vehiculo.id === id)?.cantidad ?? 0;
  }

  // Añade el vehículo al carrito
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
    this.vehiculoAEliminar = this.vehiculos.find(v => v.id === id) || null;
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

  private ajustarPaginaActual(): void {
    if (this.paginaActual > this.totalPaginas) {
      this.paginaActual = this.totalPaginas;
    }
    if (this.paginaActual < 1) {
      this.paginaActual = 1;
    }
  }

  guardarEstado(): void {
    const estado: EstadoPersistido = {
      filtroTipo: this.filtroTipo,
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
    };
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(estado));
  }

  private cargarEstadoPersistido(): void {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) return;

    try {
      const estado = JSON.parse(raw) as Partial<EstadoPersistido>;
      this.filtroTipo = typeof estado.filtroTipo === 'string' ? estado.filtroTipo : this.filtroTipo;
      this.busqueda = typeof estado.busqueda === 'string' ? estado.busqueda : this.busqueda;
      this.precioMin = typeof estado.precioMin === 'number' ? estado.precioMin : this.precioMin;
      this.precioMax = typeof estado.precioMax === 'number' ? estado.precioMax : this.precioMax;
      this.cilindradaMin = this.parseRangoNumero(estado.cilindradaMin, 0, 5000, this.cilindradaMin);
      this.cilindradaMax = this.parseRangoNumero(estado.cilindradaMax, 0, 5000, this.cilindradaMax);
      this.potenciaMin = this.parseRangoNumero(estado.potenciaMin, 0, 500, this.potenciaMin);
      this.potenciaMax = this.parseRangoNumero(estado.potenciaMax, 0, 500, this.potenciaMax);
      this.soloFavoritos = typeof estado.soloFavoritos === 'boolean' ? estado.soloFavoritos : this.soloFavoritos;
      this.ordenarPor = this.esCampoOrdenValido(estado.ordenarPor) ? estado.ordenarPor : this.ordenarPor;
      this.ordenAscendente = typeof estado.ordenAscendente === 'boolean' ? estado.ordenAscendente : this.ordenAscendente;
      this.vistaActual = this.esVistaValida(estado.vistaActual) ? estado.vistaActual : this.vistaActual;
      this.paginaActual = typeof estado.paginaActual === 'number' ? estado.paginaActual : this.paginaActual;
      this.itemsPorPagina = this.esItemsPorPaginaValido(estado.itemsPorPagina) ? estado.itemsPorPagina : this.itemsPorPagina;
      this.favoritosIds = Array.isArray(estado.favoritosIds)
        ? estado.favoritosIds.filter((id): id is number => typeof id === 'number')
        : this.favoritosIds;
      this.normalizarRangosCaracteristicas();
    } catch {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private esCampoOrdenValido(valor: unknown): valor is CampoOrden {
    return valor === 'marca' || valor === 'modelo' || valor === 'anio' || valor === 'precio' || valor === 'disponible';
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
}
