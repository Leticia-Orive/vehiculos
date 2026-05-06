import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';
import { AuthService } from '../auth.service';
import { CarritoService } from '../carrito.service';

@Component({
  selector: 'app-vehiculo-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './vehiculo-detalle.html',
  styleUrl: './vehiculo-detalle.scss',
})
export class VehiculoDetalle implements OnInit {
  vehiculo: Vehiculo | undefined;
  esAdmin: boolean = false;
  mensajeCarrito: string = '';

  constructor(
    private route: ActivatedRoute,
    private vehiculoService: VehiculoService,
    private authService: AuthService,
    private carritoService: CarritoService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Lee el id de la URL y carga el vehículo correspondiente
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.vehiculo = this.vehiculoService.getVehiculoPorId(id);
    // Comprueba si el usuario logueado es admin para mostrar botón de editar
    this.esAdmin = this.authService.esAdmin();
  }

  // Añade el vehículo al carrito y muestra confirmación breve
  agregarAlCarrito(): void {
    if (this.vehiculo) {
      this.carritoService.agregar(this.vehiculo);
      this.mensajeCarrito = '¡Añadido al carrito!';
      setTimeout(() => (this.mensajeCarrito = ''), 2000);
    }
  }

  // Navega a la vista del carrito sin añadir nada
  irAlCarrito(): void {
    this.router.navigate(['/carrito']);
  }

  // Añade al carrito y va directamente al checkout
  comprarAhora(): void {
    if (this.vehiculo) {
      this.carritoService.agregar(this.vehiculo);
      this.router.navigate(['/checkout']);
    }
  }
}
