import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent implements OnDestroy {
  // Datos del formulario de login
  username: string = '';
  password: string = '';
  recordarme: boolean = false;

  // Control de errores
  errorMensaje: string = '';
  cargando: boolean = false;

  // Toggle mostrar contraseña
  mostrarPassword: boolean = false;

  private readonly recordarmeKey = 'login_recordarme_username';
  private loginTimer: ReturnType<typeof setTimeout> | null = null;

  togglePassword(): void {
    this.mostrarPassword = !this.mostrarPassword;
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private titleService: Title,
  ) {
    this.titleService.setTitle('Iniciar sesión | Vehículos');
    this.cargarRecuerdoUsuario();
  }

  private cargarRecuerdoUsuario(): void {
    const usuarioGuardado = localStorage.getItem(this.recordarmeKey);
    if (usuarioGuardado) {
      this.username = usuarioGuardado;
      this.recordarme = true;
    }
  }

  private guardarRecuerdoUsuario(): void {
    if (this.recordarme) {
      localStorage.setItem(this.recordarmeKey, this.username);
    } else {
      localStorage.removeItem(this.recordarmeKey);
    }
  }

  // Ejecuta el login al enviar el formulario
  onLogin(): void {
    this.errorMensaje = '';

    if (this.cargando) {
      return;
    }

    if (!this.username || !this.password) {
      this.errorMensaje = 'Por favor completa usuario y contraseña';
      return;
    }

    this.cargando = true;

    // Simula un pequeño delay (como si fuese una consulta al servidor)
    this.loginTimer = setTimeout(() => {
      const loginExitoso = this.authService.login(this.username, this.password);
      this.cargando = false;
      this.loginTimer = null;

      if (loginExitoso) {
        this.guardarRecuerdoUsuario();
        this.router.navigate(['/']);
      } else {
        this.errorMensaje = 'Usuario o contraseña incorrectos';
        this.password = ''; // Limpia la contraseña por seguridad
      }
    }, 500);
  }

  ngOnDestroy(): void {
    if (this.loginTimer) {
      clearTimeout(this.loginTimer);
      this.loginTimer = null;
    }
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
