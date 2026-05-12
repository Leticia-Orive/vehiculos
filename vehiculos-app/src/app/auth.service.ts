import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

export interface Usuario {
  username: string;
  password: string;
  nombre: string;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Usuarios predefinidos para la demo
  private usuariosValidos: Usuario[] = [
    { username: 'admin', password: 'admin123', nombre: 'Administrador' },
    { username: 'user', password: 'user123', nombre: 'Usuario Demo' },
  ];

  // Observable para rastrear si el usuario está autenticado
  private autenticadoSubject = new BehaviorSubject<boolean>(this.estaAutenticado());
  public autenticado$ = this.autenticadoSubject.asObservable();

  // Usuario actual logueado
  private usuarioActualSubject = new BehaviorSubject<string | null>(this.obtenerUsuarioGuardado());
  public usuarioActual$ = this.usuarioActualSubject.asObservable();

  constructor() {}

  // API pública para validar sesión desde guards/componentes.
  estaAutenticado(): boolean {
    return this.tieneSesionActiva();
  }

  // Registra un nuevo usuario; retorna error si el username ya existe
  registrar(username: string, password: string, nombre: string): { ok: boolean; error?: string } {
    const existe = this.usuariosValidos.find((u) => u.username === username);
    if (existe) {
      return { ok: false, error: 'El usuario ya existe' };
    }
    this.usuariosValidos.push({ username, password, nombre });
    return { ok: true };
  }

  // Intenta login con usuario y contraseña
  login(username: string, password: string): boolean {
    const usuario = this.usuariosValidos.find(
      (u) => u.username === username && u.password === password,
    );

    if (usuario) {
      localStorage.setItem('usuario_autenticado', username);
      localStorage.setItem('nombre_usuario', usuario.nombre);
      this.autenticadoSubject.next(true);
      this.usuarioActualSubject.next(username);
      return true;
    }
    return false;
  }

  // Cierra sesión
  logout(): void {
    localStorage.removeItem('usuario_autenticado');
    localStorage.removeItem('nombre_usuario');
    this.autenticadoSubject.next(false);
    this.usuarioActualSubject.next(null);
  }

  // Verifica si hay una sesión activa
  private tieneSesionActiva(): boolean {
    return !!localStorage.getItem('usuario_autenticado');
  }

  // Obtiene el usuario guardado en localStorage
  private obtenerUsuarioGuardado(): string | null {
    return localStorage.getItem('usuario_autenticado');
  }

  // Retorna el nombre del usuario actual
  obtenerNombreUsuario(): string {
    return localStorage.getItem('nombre_usuario') || 'Usuario';
  }

  // Indica si el usuario logueado es administrador
  esAdmin(): boolean {
    return localStorage.getItem('usuario_autenticado') === 'admin';
  }
}
