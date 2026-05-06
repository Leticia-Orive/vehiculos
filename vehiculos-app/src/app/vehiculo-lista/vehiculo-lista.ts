import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';

@Component({
  selector: 'app-vehiculo-lista',
  imports: [CommonModule, RouterLink],
  templateUrl: './vehiculo-lista.html',
  styleUrl: './vehiculo-lista.scss',
})
export class VehiculoLista implements OnInit {
  vehiculos: Vehiculo[] = [];
  filtroTipo: string = '';

  constructor(private vehiculoService: VehiculoService) {}

  ngOnInit(): void {
    this.vehiculos = this.vehiculoService.getVehiculos();
  }

  get vehiculosFiltrados(): Vehiculo[] {
    if (!this.filtroTipo) return this.vehiculos;
    return this.vehiculos.filter(v => v.tipo === this.filtroTipo);
  }

  eliminar(id: number): void {
    this.vehiculoService.eliminarVehiculo(id);
    this.vehiculos = this.vehiculoService.getVehiculos();
  }

  setFiltro(tipo: string): void {
    this.filtroTipo = tipo;
  }
}
