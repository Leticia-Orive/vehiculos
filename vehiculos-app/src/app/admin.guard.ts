import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

// Guard de autorización por rol: solo permite acceso al usuario administrador.
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  if (authService.esAdmin()) return true;
  router.navigate(['/']);
  return false;
};
