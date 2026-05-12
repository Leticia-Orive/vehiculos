import { Injectable } from '@angular/core';
import { Vehiculo } from './vehiculo.model';

@Injectable({
  providedIn: 'root',
})
export class VehiculoService {
  // Datos en memoria para la demo; las imágenes apuntan a archivos locales en /public/vehiculos.
  private vehiculos: Vehiculo[] = [
    {
      id: 1,
      marca: 'Toyota',
      modelo: 'Corolla',
      imagen: '/vehiculos/toyota-corolla.jpg',
      anio: 2024,
      color: 'Blanco',
      precio: 25000,
      tipo: 'auto',
      disponible: true,
      cilindrada: 1800,
      potencia: 132,
    },
    {
      id: 2,
      marca: 'Ford',
      modelo: 'F-150',
      imagen: '/vehiculos/ford-f150.jpg',
      anio: 2023,
      color: 'Negro',
      precio: 45000,
      tipo: 'camioneta',
      disponible: true,
      cilindrada: 3500,
      potencia: 290,
    },
    {
      id: 3,
      marca: 'Honda',
      modelo: 'CBR600',
      imagen: '/vehiculos/honda-cbr600.jpg',
      anio: 2025,
      color: 'Rojo',
      precio: 12000,
      tipo: 'moto',
      disponible: false,
      cilindrada: 600,
      potencia: 95,
    },
    {
      id: 4,
      marca: 'Chevrolet',
      modelo: 'Silverado',
      imagen: '/vehiculos/chevrolet-silverado.jpg',
      anio: 2024,
      color: 'Azul',
      precio: 52000,
      tipo: 'camioneta',
      disponible: true,
      cilindrada: 5300,
      potencia: 355,
    },
    {
      id: 5,
      marca: 'Volkswagen',
      modelo: 'Golf',
      imagen: '/vehiculos/volkswagen-golf.jpg',
      anio: 2025,
      color: 'Gris',
      precio: 28000,
      tipo: 'auto',
      disponible: true,
      cilindrada: 1400,
      potencia: 150,
    },
    {
      id: 6,
      marca: 'Mercedes-Benz',
      modelo: 'Actros',
      imagen: '/vehiculos/mercedes-actros.jpg',
      anio: 2023,
      color: 'Blanco',
      precio: 120000,
      tipo: 'camion',
      disponible: false,
      cilindrada: 12800,
      potencia: 510,
    },
  ];

  getVehiculos(): Vehiculo[] {
    return this.vehiculos;
  }

  getVehiculoPorId(id: number): Vehiculo | undefined {
    return this.vehiculos.find((v) => v.id === id);
  }

  agregarVehiculo(vehiculo: Vehiculo): void {
    // Genera un ID incremental seguro con reduce: evita el RangeError de spread en arrays
    // grandes y el -Infinity que retorna Math.max() si el array está vacío.
    const nuevoId = this.vehiculos.reduce((max, v) => Math.max(max, v.id), 0) + 1;
    this.vehiculos.push({ ...vehiculo, id: nuevoId });
  }

  eliminarVehiculo(id: number): void {
    this.vehiculos = this.vehiculos.filter((v) => v.id !== id);
  }

  // Actualiza los datos de un vehículo existente
  actualizarVehiculo(vehiculoActualizado: Vehiculo): void {
    const idx = this.vehiculos.findIndex((v) => v.id === vehiculoActualizado.id);
    if (idx !== -1) {
      this.vehiculos[idx] = { ...vehiculoActualizado };
    }
  }
}
