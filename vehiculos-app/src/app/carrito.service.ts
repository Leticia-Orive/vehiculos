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
export class CarritoService {
  // Lista reactiva de ítems en el carrito
  private itemsSubject = new BehaviorSubject<ItemCarrito[]>([]);
  public items$ = this.itemsSubject.asObservable();

  // Añade un vehículo al carrito; si ya existe incrementa la cantidad
  agregar(vehiculo: Vehiculo): void {
    const items = this.itemsSubject.value;
    const existente = items.find(i => i.vehiculo.id === vehiculo.id);
    if (existente) {
      existente.cantidad += 1;
      this.itemsSubject.next([...items]);
    } else {
      this.itemsSubject.next([...items, { vehiculo, cantidad: 1 }]);
    }
  }

  // Elimina un ítem del carrito por id de vehículo
  eliminar(vehiculoId: number): void {
    this.itemsSubject.next(
      this.itemsSubject.value.filter(i => i.vehiculo.id !== vehiculoId)
    );
  }

  // Cambia la cantidad de un ítem; si llega a 0 lo elimina
  cambiarCantidad(vehiculoId: number, cantidad: number): void {
    if (cantidad <= 0) {
      this.eliminar(vehiculoId);
      return;
    }
    const items = this.itemsSubject.value.map(i =>
      i.vehiculo.id === vehiculoId ? { ...i, cantidad } : i
    );
    this.itemsSubject.next(items);
  }

  // Vacía el carrito completo
  limpiar(): void {
    this.itemsSubject.next([]);
  }

  // Devuelve el total a pagar
  get total(): number {
    return this.itemsSubject.value.reduce(
      (acc, i) => acc + i.vehiculo.precio * i.cantidad,
      0
    );
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
