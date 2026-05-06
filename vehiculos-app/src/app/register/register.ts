import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class RegisterComponent {
  // Datos del formulario
  nombre: string = '';
  username: string = '';
  password: string = '';
  confirmarPassword: string = '';

  // Control de estado
  errorMensaje: string = '';
  exitoMensaje: string = '';
  cargando: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  // Valida y registra al usuario
  onRegistrar(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    if (!this.nombre || !this.username || !this.password || !this.confirmarPassword) {
      this.errorMensaje = 'Por favor completa todos los campos';
      return;
    }

    if (this.username.length < 3) {
      this.errorMensaje = 'El usuario debe tener al menos 3 caracteres';
      return;
    }

    if (this.password.length < 6) {
      this.errorMensaje = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    // Verifica que las contraseñas coincidan
    if (this.password !== this.confirmarPassword) {
      this.errorMensaje = 'Las contraseñas no coinciden';
      return;
    }

    this.cargando = true;

    setTimeout(() => {
      const resultado = this.authService.registrar(this.username, this.password, this.nombre);
      this.cargando = false;

      if (resultado.ok) {
        // Muestra mensaje de éxito y redirige al login tras 1.5s
        this.exitoMensaje = '¡Cuenta creada con éxito! Redirigiendo al login...';
        setTimeout(() => this.router.navigate(['/login']), 1500);
      } else {
        this.errorMensaje = resultado.error || 'Error al registrar el usuario';
      }
    }, 500);
  }
}
