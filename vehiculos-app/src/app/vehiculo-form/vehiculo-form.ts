import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';

@Component({
  selector: 'app-vehiculo-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vehiculo-form.html',
  styleUrl: './vehiculo-form.scss',
})
export class VehiculoFormComponent implements OnInit {
  // Modo: 'add' para nuevo vehículo, 'edit' para editar uno existente
  modo: 'add' | 'edit' = 'add';

  // Datos del formulario inicializados con valores vacíos
  vehiculo: Omit<Vehiculo, 'id'> & { id?: number } = {
    marca: '',
    modelo: '',
    imagen: '',
    anio: new Date().getFullYear(),
    color: '',
    precio: 0,
    tipo: 'auto',
    disponible: true,
  };

  errorMensaje: string = '';
  exitoMensaje: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehiculoService: VehiculoService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      // Si hay id en la ruta estamos en modo edición
      this.modo = 'edit';
      const encontrado = this.vehiculoService.getVehiculoPorId(Number(id));
      if (encontrado) {
        // Copia el vehículo existente al formulario
        this.vehiculo = { ...encontrado };
      } else {
        this.router.navigate(['/']);
      }
    }
  }

  // Guarda el vehículo (nuevo o editado)
  onGuardar(): void {
    this.errorMensaje = '';

    if (!this.vehiculo.marca || !this.vehiculo.modelo || !this.vehiculo.color || !this.vehiculo.imagen) {
      this.errorMensaje = 'Marca, modelo, color e imagen son obligatorios';
      return;
    }
    if (this.vehiculo.precio <= 0) {
      this.errorMensaje = 'El precio debe ser mayor que 0';
      return;
    }
    if (this.vehiculo.anio < 1900 || this.vehiculo.anio > new Date().getFullYear() + 2) {
      this.errorMensaje = 'El año no es válido';
      return;
    }

    if (this.modo === 'add') {
      this.vehiculoService.agregarVehiculo(this.vehiculo as Vehiculo);
      this.exitoMensaje = '¡Vehículo añadido correctamente!';
    } else {
      this.vehiculoService.actualizarVehiculo(this.vehiculo as Vehiculo);
      this.exitoMensaje = '¡Vehículo actualizado correctamente!';
    }

    setTimeout(() => this.router.navigate(['/']), 1200);
  }

  get titulo(): string {
    return this.modo === 'add' ? 'Añadir Vehículo' : 'Editar Vehículo';
  }
}
