import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
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
  email: string = '';
  password: string = '';
  confirmarPassword: string = '';

  // Control de estado
  errorMensaje: string = '';
  exitoMensaje: string = '';
  cargando: boolean = false;

  // Toggle visibilidad contraseñas
  mostrarPassword: boolean = false;
  mostrarConfirmar: boolean = false;

  togglePassword(): void { this.mostrarPassword = !this.mostrarPassword; }
  toggleConfirmar(): void { this.mostrarConfirmar = !this.mostrarConfirmar; }

  // Email válido y contraseñas coinciden
  get emailValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  get contraseniasCoinciden(): boolean {
    return !!this.password && !!this.confirmarPassword && this.password === this.confirmarPassword;
  }

  get formularioValido(): boolean {
    return !!this.nombre && !!this.username && this.username.length >= 3 &&
           this.emailValido && this.password.length >= 6 && this.contraseniasCoinciden;
  }

  // Fortaleza de contraseña (0-4)
  get fuerzaPassword(): number {
    const p = this.password;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 6)  score++;
    if (p.length >= 10) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    return score;
  }

  get fuerzaLabel(): string {
    return ['', 'Débil', 'Regular', 'Buena', 'Fuerte'][this.fuerzaPassword];
  }

  get fuerzaClase(): string {
    return ['', 'debil', 'regular', 'buena', 'fuerte'][this.fuerzaPassword];
  }

  constructor(private authService: AuthService, private router: Router, private titleService: Title) {
    this.titleService.setTitle('Crear cuenta | Vehículos');
  }

  // Valida y registra al usuario
  onRegistrar(): void {
    this.errorMensaje = '';
    this.exitoMensaje = '';

    if (!this.nombre || !this.username || !this.email || !this.password || !this.confirmarPassword) {
      this.errorMensaje = 'Por favor completa todos los campos';
      return;
    }

    if (this.username.length < 3) {
      this.errorMensaje = 'El usuario debe tener al menos 3 caracteres';
      return;
    }

    if (!this.emailValido) {
      this.errorMensaje = 'Por favor ingresa un email válido';
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
