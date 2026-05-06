import { Injectable } from '@angular/core';
import { Vehiculo } from './vehiculo.model';

@Injectable({
  providedIn: 'root',
})
export class VehiculoService {
  private vehiculos: Vehiculo[] = [
    { id: 1, marca: 'Toyota', modelo: 'Corolla', anio: 2024, color: 'Blanco', precio: 25000, tipo: 'auto', disponible: true },
    { id: 2, marca: 'Ford', modelo: 'F-150', anio: 2023, color: 'Negro', precio: 45000, tipo: 'camioneta', disponible: true },
    { id: 3, marca: 'Honda', modelo: 'CBR600', anio: 2025, color: 'Rojo', precio: 12000, tipo: 'moto', disponible: false },
    { id: 4, marca: 'Chevrolet', modelo: 'Silverado', anio: 2024, color: 'Azul', precio: 52000, tipo: 'camioneta', disponible: true },
    { id: 5, marca: 'Volkswagen', modelo: 'Golf', anio: 2025, color: 'Gris', precio: 28000, tipo: 'auto', disponible: true },
    { id: 6, marca: 'Mercedes-Benz', modelo: 'Actros', anio: 2023, color: 'Blanco', precio: 120000, tipo: 'camion', disponible: false },
  ];

  getVehiculos(): Vehiculo[] {
    return this.vehiculos;
  }

  getVehiculoPorId(id: number): Vehiculo | undefined {
    return this.vehiculos.find(v => v.id === id);
  }

  agregarVehiculo(vehiculo: Vehiculo): void {
    const nuevoId = Math.max(...this.vehiculos.map(v => v.id)) + 1;
    this.vehiculos.push({ ...vehiculo, id: nuevoId });
  }

  eliminarVehiculo(id: number): void {
    this.vehiculos = this.vehiculos.filter(v => v.id !== id);
  }
}

