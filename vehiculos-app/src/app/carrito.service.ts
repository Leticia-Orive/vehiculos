import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Vehiculo } from './vehiculo.model';

export interface ItemCarrito {
  vehiculo: Vehiculo;
  cantidad: number;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Servicio de estado del carrito.
 * Sirve para agregar/quitar productos, calcular totales y persistir el contenido en localStorage.
 */
export class CarritoService {
  private readonly storageKey = 'vehiculos.carrito.items';
  static readonly MAX_CANTIDAD = 99;

  // Lista reactiva de ítems en el carrito
  private itemsSubject = new BehaviorSubject<ItemCarrito[]>([]);
  public items$ = this.itemsSubject.asObservable();

  constructor() {
    this.restaurarDesdeStorage();
  }

  // Sincroniza estado reactivo + persistencia en cada cambio del carrito.
  private actualizarItems(items: ItemCarrito[]): void {
    this.itemsSubject.next(items);
    localStorage.setItem(this.storageKey, JSON.stringify(items));
  }

  // Recupera carrito previo y normaliza cantidades para evitar datos inválidos al iniciar.
  private restaurarDesdeStorage(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ItemCarrito[];
      if (!Array.isArray(parsed)) {
        return;
      }

      const normalizados = parsed
        .filter((i) => i && i.vehiculo && typeof i.cantidad === 'number' && i.cantidad > 0)
        .map((i) => ({ ...i, cantidad: Math.floor(i.cantidad) }));

      this.itemsSubject.next(normalizados);
    } catch {
      localStorage.removeItem(this.storageKey);
    }
  }

  // Añade un vehículo al carrito; si ya existe incrementa la cantidad hasta MAX_CANTIDAD
  agregar(vehiculo: Vehiculo): void {
    const items = this.itemsSubject.value;
    const existente = items.find((i) => i.vehiculo.id === vehiculo.id);
    if (existente) {
      if (existente.cantidad >= CarritoService.MAX_CANTIDAD) return;
      this.actualizarItems(
        items.map((i) => (i.vehiculo.id === vehiculo.id ? { ...i, cantidad: i.cantidad + 1 } : i)),
      );
    } else {
      this.actualizarItems([...items, { vehiculo, cantidad: 1 }]);
    }
  }

  // Elimina un ítem del carrito por id de vehículo
  eliminar(vehiculoId: number): void {
    this.actualizarItems(this.itemsSubject.value.filter((i) => i.vehiculo.id !== vehiculoId));
  }

  // Cambia la cantidad de un ítem; si llega a 0 lo elimina
  cambiarCantidad(vehiculoId: number, cantidad: number): void {
    if (cantidad <= 0) {
      this.eliminar(vehiculoId);
      return;
    }
    const cantidadFinal = Math.min(Math.floor(cantidad), CarritoService.MAX_CANTIDAD);
    const items = this.itemsSubject.value.map((i) =>
      i.vehiculo.id === vehiculoId ? { ...i, cantidad: cantidadFinal } : i,
    );
    this.actualizarItems(items);
  }

  // Vacía el carrito completo
  limpiar(): void {
    this.actualizarItems([]);
  }

  // Devuelve el total a pagar
  get total(): number {
    return this.itemsSubject.value.reduce((acc, i) => acc + i.vehiculo.precio * i.cantidad, 0);
  }

  // Número total de ítems en el carrito
  get cantidadTotal(): number {
    return this.itemsSubject.value.reduce((acc, i) => acc + i.cantidad, 0);
  }

  // Snapshot actual sin suscripción
  get items(): ItemCarrito[] {
    return this.itemsSubject.value;
  }
}
