import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CarritoService, ItemCarrito } from '../carrito.service';

@Component({
  selector: 'app-carrito',
  imports: [CommonModule, RouterLink],
  templateUrl: './carrito.html',
  styleUrl: './carrito.scss',
})
export class CarritoComponent implements OnInit {
  items: ItemCarrito[] = [];

  constructor(private carritoService: CarritoService, private router: Router) {}

  ngOnInit(): void {
    // Suscripción al observable para reflejar cambios en tiempo real
    this.carritoService.items$.subscribe(items => (this.items = items));
  }

  // Elimina un ítem del carrito
  eliminar(vehiculoId: number): void {
    this.carritoService.eliminar(vehiculoId);
  }

  // Cambia la cantidad de un ítem
  cambiarCantidad(vehiculoId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.carritoService.cambiarCantidad(vehiculoId, Number(input.value));
  }

  get total(): number {
    return this.carritoService.total;
  }

  // Navega al checkout
  irACheckout(): void {
    this.router.navigate(['/checkout']);
  }
}
