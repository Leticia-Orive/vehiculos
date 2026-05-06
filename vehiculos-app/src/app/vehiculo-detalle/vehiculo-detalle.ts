import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { VehiculoService } from '../vehiculo';
import { Vehiculo } from '../vehiculo.model';

@Component({
  selector: 'app-vehiculo-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './vehiculo-detalle.html',
  styleUrl: './vehiculo-detalle.scss',
})
export class VehiculoDetalle implements OnInit {
  vehiculo: Vehiculo | undefined;

  constructor(
    private route: ActivatedRoute,
    private vehiculoService: VehiculoService
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.vehiculo = this.vehiculoService.getVehiculoPorId(id);
  }
}
