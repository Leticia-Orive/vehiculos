import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  // Datos del formulario de login
  username: string = '';
  password: string = '';

  // Control de errores
  errorMensaje: string = '';
  cargando: boolean = false;

  constructor(private authService: AuthService, private router: Router) {}

  // Ejecuta el login al enviar el formulario
  onLogin(): void {
    this.errorMensaje = '';

    if (!this.username || !this.password) {
      this.errorMensaje = 'Por favor completa usuario y contraseña';
      return;
    }

    this.cargando = true;

    // Simula un pequeño delay (como si fuese una consulta al servidor)
    setTimeout(() => {
      const loginExitoso = this.authService.login(this.username, this.password);
      this.cargando = false;

      if (loginExitoso) {
        // Redirige a la página principal
        this.router.navigate(['/']);
      } else {
        this.errorMensaje = 'Usuario o contraseña incorrectos';
        this.password = ''; // Limpia la contraseña por seguridad
      }
    }, 500);
  }

  // Prellenado de credenciales de demo
  cargarDemoAdmin(): void {
    this.username = 'admin';
    this.password = 'admin123';
  }

  cargarDemoUser(): void {
    this.username = 'user';
    this.password = 'user123';
  }
}
