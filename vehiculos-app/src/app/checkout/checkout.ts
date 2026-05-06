import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CarritoService, ItemCarrito } from '../carrito.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnInit {
  items: ItemCarrito[] = [];
  nombreUsuario: string = '';
  pedidoCompletado: boolean = false;
  numeroPedido: string = '';

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.items = this.carritoService.items;
    this.nombreUsuario = this.authService.obtenerNombreUsuario();

    // Si el carrito está vacío, redirige al inicio
    if (this.items.length === 0) {
      this.router.navigate(['/']);
    }
  }

  get total(): number {
    return this.carritoService.total;
  }

  // Confirma la compra, vacía el carrito y muestra confirmación
  confirmarCompra(): void {
    this.numeroPedido = 'PED-' + Date.now().toString().slice(-6);
    this.carritoService.limpiar();
    this.pedidoCompletado = true;
  }

  // Vuelve al inicio tras la compra
  irAlInicio(): void {
    this.router.navigate(['/']);
  }
}
