import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';
import { ModalConfirmacion } from '../modal-confirmacion/modal-confirmacion';

@Component({
  selector: 'app-vehiculo-lista',
  imports: [CommonModule, RouterLink, ModalConfirmacion],
  templateUrl: './vehiculo-lista.html',
  styleUrl: './vehiculo-lista.scss',
})
export class VehiculoLista implements OnInit {
  vehiculos: Vehiculo[] = [];
  filtroTipo: string = '';

  // Control del modal de confirmación
  mostrarModalConfirmacion: boolean = false;
  vehiculoAEliminar: Vehiculo | null = null;

  constructor(private vehiculoService: VehiculoService) {}

  ngOnInit(): void {
    this.vehiculos = this.vehiculoService.getVehiculos();
  }

  get vehiculosFiltrados(): Vehiculo[] {
    if (!this.filtroTipo) return this.vehiculos;
    return this.vehiculos.filter(v => v.tipo === this.filtroTipo);
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
  }
}
