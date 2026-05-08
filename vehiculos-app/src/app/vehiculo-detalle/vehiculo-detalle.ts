import { Component, HostListener, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';
import { AuthService } from '../auth.service';
import { CarritoService } from '../carrito.service';

@Component({
  selector: 'app-vehiculo-detalle',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './vehiculo-detalle.html',
  styleUrl: './vehiculo-detalle.scss',
})
export class VehiculoDetalle implements OnInit, OnDestroy {
  readonly cantidadMaxima: number = 99;
  readonly imagenPlaceholder: string =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='900' height='560' viewBox='0 0 900 560'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='%23eef1f5'/><stop offset='100%' stop-color='%23d9e1ea'/></linearGradient></defs><rect width='900' height='560' fill='url(%23g)'/><g fill='none' stroke='%238fa3b7' stroke-width='10' stroke-linecap='round' stroke-linejoin='round'><rect x='200' y='170' width='500' height='220' rx='16'/><path d='M260 330l120-110 90 85 70-65 100 90'/><circle cx='605' cy='235' r='28'/></g><text x='50%' y='82%' text-anchor='middle' fill='%235b6f84' font-size='34' font-family='Segoe UI, Arial, sans-serif'>Imagen no disponible</text></svg>";
  vehiculo: Vehiculo | undefined;
  vehiculosRelacionados: Vehiculo[] = [];
  esAdmin: boolean = false;
  mensajeCarrito: string = '';
  cantidad: number = 1;
  animandoCarrito: boolean = false;
  lightboxAbierto: boolean = false;
  cantidadEnCarrito: number = 0;
  private routeSub!: Subscription;
  private cartSub?: Subscription;
  private mensajeTimer: ReturnType<typeof setTimeout> | null = null;
  private animacionTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private vehiculoService: VehiculoService,
    private authService: AuthService,
    private carritoService: CarritoService,
    private router: Router,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.esAdmin = this.authService.esAdmin();
    this.cartSub = this.carritoService.items$.subscribe(items => {
      this.cantidadEnCarrito = items.find(i => i.vehiculo.id === this.vehiculo?.id)?.cantidad ?? 0;
    });
    this.routeSub = this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      this.vehiculo = this.vehiculoService.getVehiculoPorId(id);
      if (this.vehiculo) {
        this.titleService.setTitle(`${this.vehiculo.marca} ${this.vehiculo.modelo} | Vehículos`);
        this.cantidadEnCarrito = this.carritoService.items.find(i => i.vehiculo.id === this.vehiculo?.id)?.cantidad ?? 0;
      } else {
        this.titleService.setTitle('Vehículo no encontrado | Vehículos');
      }
      this.mensajeCarrito = '';
      this.cargarRelacionados();
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.cartSub?.unsubscribe();
    if (this.mensajeTimer) {
      clearTimeout(this.mensajeTimer);
      this.mensajeTimer = null;
    }
    if (this.animacionTimer) {
      clearTimeout(this.animacionTimer);
      this.animacionTimer = null;
    }
  }

  private cargarRelacionados(): void {
    if (!this.vehiculo) { this.vehiculosRelacionados = []; return; }
    this.vehiculosRelacionados = this.vehiculoService
      .getVehiculos()
      .filter(v => v.tipo === this.vehiculo!.tipo && v.id !== this.vehiculo!.id)
      .slice(0, 3);
  }

  @HostListener('document:keydown.escape')
  cerrarLightbox(): void {
    this.lightboxAbierto = false;
  }

  abrirLightbox(): void {
    this.lightboxAbierto = true;
  }

  onImagenError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img || img.src === this.imagenPlaceholder) {
      return;
    }
    img.src = this.imagenPlaceholder;
  }

  // Incrementar cantidad
  incrementarCantidad(): void {
    if (this.cantidad < this.cantidadMaxima) {
      this.cantidad++;
    }
  }

  // Decrementar cantidad
  decrementarCantidad(): void {
    if (this.cantidad > 1) this.cantidad--;
  }

  normalizarCantidad(): void {
    const cantidad = Number(this.cantidad);
    if (!Number.isFinite(cantidad)) {
      this.cantidad = 1;
      return;
    }

    const redondeada = Math.floor(cantidad);
    this.cantidad = Math.min(this.cantidadMaxima, Math.max(1, redondeada));
  }

  // Añade el vehículo al carrito con cantidad
  agregarAlCarrito(): void {
    if (this.vehiculo) {
      this.normalizarCantidad();
      const cantidadAAgregar = this.cantidad;

      for (let i = 0; i < cantidadAAgregar; i++) {
        this.carritoService.agregar(this.vehiculo);
      }
      this.animandoCarrito = true;
      this.setMensajeCarritoTemporal(`¡${cantidadAAgregar} vehículo${cantidadAAgregar > 1 ? 's' : ''} añadido${cantidadAAgregar > 1 ? 's' : ''}!`, 2000);

      if (this.animacionTimer) {
        clearTimeout(this.animacionTimer);
      }

      this.animacionTimer = setTimeout(() => {
        this.animandoCarrito = false;
        this.cantidad = 1;
        this.animacionTimer = null;
      }, 2000);
    }
  }

  // Compra ahora con cantidad
  comprarAhora(): void {
    if (this.vehiculo) {
      this.normalizarCantidad();
      const cantidadAAgregar = this.cantidad;

      for (let i = 0; i < cantidadAAgregar; i++) {
        this.carritoService.agregar(this.vehiculo);
      }
      this.router.navigate(['/checkout']);
    }
  }

  // Compra rápida relacionado
  comprarRelacionado(vehiculo: Vehiculo): void {
    this.carritoService.agregar(vehiculo);
    this.router.navigate(['/checkout']);
  }

  // Agrega una unidad más del vehículo actual al carrito
  agregarUnaUnidad(): void {
    if (this.vehiculo) {
      this.carritoService.agregar(this.vehiculo);
      this.setMensajeCarritoTemporal('✓ 1 unidad añadida', 1200);
    }
  }

  // Quita una unidad del vehículo actual del carrito
  quitarUnaUnidad(): void {
    if (this.vehiculo && this.cantidadEnCarrito > 0) {
      this.carritoService.cambiarCantidad(this.vehiculo.id, this.cantidadEnCarrito - 1);
      this.setMensajeCarritoTemporal('✓ 1 unidad removida', 1200);
    }
  }

  // Quita todas las unidades del vehículo actual del carrito
  limpiarDelCarrito(): void {
    if (this.vehiculo && this.cantidadEnCarrito > 0) {
      this.carritoService.eliminar(this.vehiculo.id);
      this.setMensajeCarritoTemporal('✓ Removido del carrito', 1200);
    }
  }

  private setMensajeCarritoTemporal(mensaje: string, ms: number, onDone?: () => void): void {
    this.mensajeCarrito = mensaje;

    if (this.mensajeTimer) {
      clearTimeout(this.mensajeTimer);
      this.mensajeTimer = null;
    }

    this.mensajeTimer = setTimeout(() => {
      this.mensajeCarrito = '';
      this.mensajeTimer = null;
      onDone?.();
    }, ms);
  }
}
