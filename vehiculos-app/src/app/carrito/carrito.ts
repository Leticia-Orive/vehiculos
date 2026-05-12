import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { CarritoService, ItemCarrito } from '../carrito.service';
import { ModalConfirmacion } from '../modal-confirmacion/modal-confirmacion';
import { FinanciacionConfigService } from '../financiacion-config.service';
import { Vehiculo } from '../vehiculo.model';

interface AhorroEstimadoFila {
  clave: string;
  marca: string;
  modelo: string;
  cantidad: number;
  ahorroUnitario: number;
  ahorroTotal: number;
}

@Component({
  selector: 'app-carrito',
  imports: [CommonModule, RouterLink, ModalConfirmacion],
  templateUrl: './carrito.html',
  styleUrl: './carrito.scss',
})
export class CarritoComponent implements OnInit, OnDestroy {
  private readonly ahorroUiStorageKey = 'carrito.ahorro.desglose.visible';
  items: ItemCarrito[] = [];
  mostrarDesgloseAhorro: boolean = true;
  mostrarConfirmacionVaciar: boolean = false;
  mostrarToastDeshacer: boolean = false;
  toastMensaje: string = '';
  private ultimoEliminado: ItemCarrito | null = null;
  private ultimoVaciado: ItemCarrito[] | null = null;
  private idsRestaurados = new Set<number>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private highlightRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  private itemsSub?: Subscription;

  constructor(
    private carritoService: CarritoService,
    private router: Router,
    private titleService: Title,
    private financiacionConfigService: FinanciacionConfigService,
  ) {}

  ngOnInit(): void {
    this.restaurarEstadoAhorro();

    // Suscripción al observable para reflejar cambios en tiempo real
    this.itemsSub = this.carritoService.items$.subscribe((items) => {
      this.items = items;
      const total = items.reduce((acc, i) => acc + i.cantidad, 0);
      this.titleService.setTitle(
        total > 0 ? `Carrito (${total}) | Vehículos` : 'Carrito | Vehículos',
      );
    });
  }

  ngOnDestroy(): void {
    this.itemsSub?.unsubscribe();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    if (this.highlightRestoreTimer) {
      clearTimeout(this.highlightRestoreTimer);
    }
  }

  // Elimina un ítem del carrito
  eliminar(vehiculoId: number): void {
    const eliminado = this.items.find((i) => i.vehiculo.id === vehiculoId);
    if (!eliminado) {
      return;
    }

    this.ultimoEliminado = this.clonarItem(eliminado);
    this.ultimoVaciado = null;
    this.toastMensaje = `Se eliminó ${eliminado.vehiculo.marca} ${eliminado.vehiculo.modelo}.`;
    this.carritoService.eliminar(vehiculoId);
    this.mostrarToastDeshacerConTimer();
  }

  deshacerEliminar(): void {
    if (this.ultimoEliminado) {
      for (let i = 0; i < this.ultimoEliminado.cantidad; i++) {
        this.carritoService.agregar(this.ultimoEliminado.vehiculo);
      }
      this.marcarRestaurados([this.ultimoEliminado.vehiculo.id]);
      this.cerrarToastDeshacer();
      return;
    }

    if (this.ultimoVaciado) {
      const restauradosIds: number[] = [];
      for (const item of this.ultimoVaciado) {
        restauradosIds.push(item.vehiculo.id);
        for (let i = 0; i < item.cantidad; i++) {
          this.carritoService.agregar(item.vehiculo);
        }
      }
      this.marcarRestaurados(restauradosIds);
      this.cerrarToastDeshacer();
    }
  }

  cerrarToastDeshacer(): void {
    this.mostrarToastDeshacer = false;
    this.toastMensaje = '';
    this.ultimoEliminado = null;
    this.ultimoVaciado = null;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  // Cambia la cantidad de un ítem
  cambiarCantidad(vehiculoId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.carritoService.cambiarCantidad(vehiculoId, Number(input.value));
  }

  // Suma 1 a la cantidad del ítem
  incrementar(vehiculoId: number, cantidadActual: number): void {
    this.carritoService.cambiarCantidad(vehiculoId, cantidadActual + 1);
  }

  // Resta 1 a la cantidad; si llega a 0 el servicio lo elimina
  decrementar(vehiculoId: number, cantidadActual: number): void {
    this.carritoService.cambiarCantidad(vehiculoId, cantidadActual - 1);
  }

  // Abre el modal de confirmación antes de vaciar
  pedirConfirmacionVaciar(): void {
    this.mostrarConfirmacionVaciar = true;
  }

  // Vacía el carrito después de confirmar
  confirmarVaciar(): void {
    if (this.items.length > 0) {
      this.ultimoVaciado = this.items.map((item) => this.clonarItem(item));
      this.ultimoEliminado = null;
      this.toastMensaje = 'Se vació el carrito.';
    }

    this.carritoService.limpiar();
    this.mostrarConfirmacionVaciar = false;
    this.mostrarToastDeshacerConTimer();
  }

  // Cierra el modal sin vaciar
  cancelarVaciar(): void {
    this.mostrarConfirmacionVaciar = false;
  }

  // Calcula el precio total sumando precio × cantidad de cada ítem
  get total(): number {
    return this.carritoService.total;
  }

  get ahorroTotalEstimado(): number {
    return this.desgloseAhorroEstimado.reduce((acc, fila) => acc + fila.ahorroTotal, 0);
  }

  get totalConAhorroEstimado(): number {
    const total = this.total - this.ahorroTotalEstimado;
    return total > 0 ? total : 0;
  }

  get desgloseAhorroEstimado(): AhorroEstimadoFila[] {
    const config = this.financiacionConfigService.getConfig();
    const acumulado: Record<string, AhorroEstimadoFila> = {};

    for (const item of this.items) {
      const clave = this.financiacionConfigService.buildModelKey(
        item.vehiculo.marca,
        item.vehiculo.modelo,
      );
      const reglaModelo = config.porModelo[clave];
      const regla = reglaModelo ?? config.porTipo[item.vehiculo.tipo] ?? config.base;
      const ahorroUnitario =
        regla.descuentoSeguro + regla.costoMantenimiento * regla.cantidadMantenimientos;

      if (!acumulado[clave]) {
        acumulado[clave] = {
          clave,
          marca: item.vehiculo.marca,
          modelo: item.vehiculo.modelo,
          cantidad: 0,
          ahorroUnitario,
          ahorroTotal: 0,
        };
      }

      acumulado[clave].cantidad += item.cantidad;
      acumulado[clave].ahorroUnitario = ahorroUnitario;
      acumulado[clave].ahorroTotal += ahorroUnitario * item.cantidad;
    }

    return Object.values(acumulado).sort((a, b) => b.ahorroTotal - a.ahorroTotal);
  }

  // Navega al checkout
  irACheckout(): void {
    this.router.navigate(['/checkout']);
  }

  irAFinanciacion(): void {
    this.router.navigate(['/checkout'], {
      queryParams: { pago: 'financiado' },
    });
  }

  toggleDesgloseAhorro(): void {
    this.mostrarDesgloseAhorro = !this.mostrarDesgloseAhorro;
    localStorage.setItem(this.ahorroUiStorageKey, this.mostrarDesgloseAhorro ? '1' : '0');
  }

  esRestaurado(vehiculoId: number): boolean {
    return this.idsRestaurados.has(vehiculoId);
  }

  private mostrarToastDeshacerConTimer(): void {
    this.mostrarToastDeshacer = true;
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastTimer = setTimeout(() => {
      this.cerrarToastDeshacer();
    }, 5000);
  }

  private clonarItem(item: ItemCarrito): ItemCarrito {
    return {
      ...item,
      vehiculo: { ...item.vehiculo },
    };
  }

  private marcarRestaurados(ids: number[]): void {
    if (this.highlightRestoreTimer) {
      clearTimeout(this.highlightRestoreTimer);
    }

    this.idsRestaurados = new Set(ids);

    this.highlightRestoreTimer = setTimeout(() => {
      this.idsRestaurados.clear();
      this.highlightRestoreTimer = null;
    }, 1400);
  }

  private restaurarEstadoAhorro(): void {
    const estadoGuardado = localStorage.getItem(this.ahorroUiStorageKey);
    if (estadoGuardado === '0') {
      this.mostrarDesgloseAhorro = false;
    }
    if (estadoGuardado === '1') {
      this.mostrarDesgloseAhorro = true;
    }
  }
}
