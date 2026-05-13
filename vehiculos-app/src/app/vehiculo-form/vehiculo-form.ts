import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';

@Component({
  selector: 'app-vehiculo-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './vehiculo-form.html',
  styleUrl: './vehiculo-form.scss',
})
/**
 * Formulario de alta/edición de vehículos para administración.
 * Reutiliza la misma vista en modo creación y modo edición.
 */
export class VehiculoFormComponent implements OnInit, OnDestroy {
  readonly anioMinimo: number = 1900;
  readonly anioMaximo: number = new Date().getFullYear() + 2;

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
  private redirectTimer: ReturnType<typeof setTimeout> | null = null;

  // Errores inline por campo
  errores: Partial<Record<string, string>> = {};

  limpiarError(campo: string): void {
    delete this.errores[campo];
    this.errorMensaje = '';
  }

  // Valida si el formulario está completo (todos los campos requeridos)
  get formularioCompleto(): boolean {
    return (
      !!this.vehiculo.marca.trim() &&
      !!this.vehiculo.modelo.trim() &&
      !!this.vehiculo.color.trim() &&
      !!this.vehiculo.imagen.trim() &&
      this.vehiculo.precio > 0 &&
      this.vehiculo.anio >= this.anioMinimo &&
      this.vehiculo.anio <= this.anioMaximo
    );
  }

  // Cuenta cuántos campos requeridos están completos
  get camposCompletos(): number {
    let count = 0;
    if (this.vehiculo.marca.trim()) count++;
    if (this.vehiculo.modelo.trim()) count++;
    if (this.vehiculo.color.trim()) count++;
    if (this.vehiculo.imagen.trim()) count++;
    if (this.vehiculo.precio > 0) count++;
    if (this.vehiculo.anio >= this.anioMinimo && this.vehiculo.anio <= this.anioMaximo) count++;
    return count;
  }

  readonly totalCamposRequeridos: number = 6;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vehiculoService: VehiculoService,
    private titleService: Title,
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
        this.titleService.setTitle(`Editar ${encontrado.marca} ${encontrado.modelo} | Vehículos`);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.titleService.setTitle('Nuevo Vehículo | Vehículos');
    }
  }

  // Guarda el vehículo (nuevo o editado)
  onGuardar(): void {
    this.errorMensaje = '';
    this.errores = {};

    this.normalizarDatosFormulario();

    if (!this.vehiculo.marca) this.errores['marca'] = 'La marca es obligatoria';
    if (!this.vehiculo.modelo) this.errores['modelo'] = 'El modelo es obligatorio';
    if (!this.vehiculo.color) this.errores['color'] = 'El color es obligatorio';
    if (!this.vehiculo.imagen) this.errores['imagen'] = 'La imagen es obligatoria';
    if (this.vehiculo.precio <= 0) this.errores['precio'] = 'El precio debe ser mayor que 0';
    if (this.vehiculo.anio < this.anioMinimo || this.vehiculo.anio > this.anioMaximo) {
      this.errores['anio'] = 'El año no es válido';
    }

    if (Object.keys(this.errores).length > 0) return;

    if (this.modo === 'add') {
      this.vehiculoService.agregarVehiculo(this.vehiculo as Vehiculo);
      this.exitoMensaje = '¡Vehículo añadido correctamente!';
    } else {
      this.vehiculoService.actualizarVehiculo(this.vehiculo as Vehiculo);
      this.exitoMensaje = '¡Vehículo actualizado correctamente!';
    }

    this.redirectTimer = setTimeout(() => {
      this.router.navigate(['/']);
      this.redirectTimer = null;
    }, 1200);
  }

  get titulo(): string {
    return this.modo === 'add' ? 'Añadir Vehículo' : 'Editar Vehículo';
  }

  onImagenError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src =
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120"><rect width="200" height="120" fill="%23e0e0e0"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="%23999">Sin imagen</text></svg>';
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) {
      clearTimeout(this.redirectTimer);
      this.redirectTimer = null;
    }
  }

  private normalizarDatosFormulario(): void {
    // Normaliza entradas para evitar espacios/formatos inconsistentes al guardar.
    this.vehiculo.marca = this.vehiculo.marca.trim();
    this.vehiculo.modelo = this.vehiculo.modelo.trim();
    this.vehiculo.color = this.vehiculo.color.trim();
    this.vehiculo.imagen = this.vehiculo.imagen.trim();
    this.vehiculo.anio = Number(this.vehiculo.anio);
    this.vehiculo.precio = Number(this.vehiculo.precio);
  }
}
