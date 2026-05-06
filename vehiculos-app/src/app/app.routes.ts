import { Routes } from '@angular/router';
import { VehiculoLista } from './vehiculo-lista/vehiculo-lista';
import { VehiculoDetalle } from './vehiculo-detalle/vehiculo-detalle';

export const routes: Routes = [
  { path: '', component: VehiculoLista },
  { path: 'vehiculo/:id', component: VehiculoDetalle },
  { path: '**', redirectTo: '' }
];
