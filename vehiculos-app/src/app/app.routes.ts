import { Routes } from '@angular/router';
import { VehiculoLista } from './vehiculo-lista/vehiculo-lista';
import { VehiculoDetalle } from './vehiculo-detalle/vehiculo-detalle';
import { LoginComponent } from './login/login';
import { RegisterComponent } from './register/register';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  // Rutas públicas (sin protección)
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // Rutas protegidas por autenticación
  { path: '', component: VehiculoLista, canActivate: [authGuard] },
  { path: 'vehiculo/:id', component: VehiculoDetalle, canActivate: [authGuard] },

  // Redirección por defecto
  { path: '**', redirectTo: '/login' }
];
