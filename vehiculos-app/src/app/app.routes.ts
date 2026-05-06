import { Routes } from '@angular/router';
import { VehiculoLista } from './vehiculo-lista/vehiculo-lista';
import { VehiculoDetalle } from './vehiculo-detalle/vehiculo-detalle';
import { LoginComponent } from './login/login';
import { RegisterComponent } from './register/register';
import { VehiculoFormComponent } from './vehiculo-form/vehiculo-form';
import { CarritoComponent } from './carrito/carrito';
import { CheckoutComponent } from './checkout/checkout';
import { authGuard } from './auth.guard';
import { adminGuard } from './admin.guard';

export const routes: Routes = [
  // Rutas públicas (sin protección)
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },

  // Rutas protegidas por autenticación
  { path: '', component: VehiculoLista, canActivate: [authGuard] },
  { path: 'vehiculo/nuevo', component: VehiculoFormComponent, canActivate: [authGuard, adminGuard] },
  { path: 'vehiculo/:id', component: VehiculoDetalle, canActivate: [authGuard] },
  { path: 'vehiculo/:id/editar', component: VehiculoFormComponent, canActivate: [authGuard, adminGuard] },
  { path: 'carrito', component: CarritoComponent, canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutComponent, canActivate: [authGuard] },

  // Redireccion por defecto
  { path: '**', redirectTo: '/login' }
];
