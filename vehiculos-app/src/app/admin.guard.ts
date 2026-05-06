import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

// Guard que permite el acceso sólo al usuario admin
export const adminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const username = localStorage.getItem('usuario_autenticado');
  if (username === 'admin') return true;
  router.navigate(['/']);
  return false;
};
