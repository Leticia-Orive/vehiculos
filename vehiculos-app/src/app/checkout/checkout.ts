import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CarritoService, ItemCarrito } from '../carrito.service';
import { AuthService } from '../auth.service';
import { FinanciacionConfigService, FinanciacionConfigState } from '../financiacion-config.service';
import { Vehiculo } from '../vehiculo.model';

interface DesgloseDescuentoTipo {
  claveModelo: string;
  marca: string;
  modelo: string;
  tipo: Vehiculo['tipo'];
  cantidad: number;
  descuentoUnitario: number;
  descuentoTotal: number;
  cantidadMantenimientos: number;
}

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnInit {
  // Estado general de la pantalla
  items: ItemCarrito[] = [];
  nombreUsuario: string = '';
  pedidoCompletado: boolean = false;
  numeroPedido: string = '';

  // Datos de forma de pago
  formaPago: 'contado' | 'financiado' = 'contado';
  pagoMensual: number = 0;
  entradaContado: number = 0;
  mensajeErrorFinanciacion: string = '';
  configFinanciacion: FinanciacionConfigState | null = null;

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private financiacionConfigService: FinanciacionConfigService
  ) {}

  ngOnInit(): void {
    // Obtiene el snapshot del carrito en el momento de entrar al checkout
    this.items = this.carritoService.items;
    this.nombreUsuario = this.authService.obtenerNombreUsuario();
    this.configFinanciacion = this.financiacionConfigService.getConfig();

    // Si el carrito está vacío, redirige al inicio
    if (this.items.length === 0) {
      this.router.navigate(['/']);
    }
  }

  // Calcula el total del pedido delegando en el servicio del carrito
  get total(): number {
    return this.carritoService.total;
  }

  // Descuentos aplicados al importe a financiar
  get totalDescuentosFinanciado(): number {
    return this.items.reduce((acumulado, item) => {
      const regla = this.obtenerReglaFinanciacion(item.vehiculo);
      const descuentoUnitario = regla.descuentoSeguro + (regla.costoMantenimiento * regla.cantidadMantenimientos);
      return acumulado + (descuentoUnitario * item.cantidad);
    }, 0);
  }

  // Desglose por modelo exacto para mostrar de forma transparente cómo se calcula el descuento
  get desgloseDescuentos(): DesgloseDescuentoTipo[] {
    const acumulado: Record<string, DesgloseDescuentoTipo> = {};

    for (const item of this.items) {
      const regla = this.obtenerReglaFinanciacion(item.vehiculo);
      const descuentoUnitario = regla.descuentoSeguro + (regla.costoMantenimiento * regla.cantidadMantenimientos);
      const claveModelo = this.claveModelo(item.vehiculo);

      if (!acumulado[claveModelo]) {
        acumulado[claveModelo] = {
          claveModelo,
          marca: item.vehiculo.marca,
          modelo: item.vehiculo.modelo,
          tipo: item.vehiculo.tipo,
          cantidad: 0,
          descuentoUnitario,
          descuentoTotal: 0,
          cantidadMantenimientos: regla.cantidadMantenimientos,
        };
      }

      const fila = acumulado[claveModelo];

      fila.cantidad += item.cantidad;
      fila.descuentoUnitario = descuentoUnitario;
      fila.cantidadMantenimientos = regla.cantidadMantenimientos;
      fila.descuentoTotal += descuentoUnitario * item.cantidad;
    }

    return Object.values(acumulado);
  }

  // Capital final que queda por financiar tras entrada y descuentos
  get saldoFinanciar(): number {
    const saldo = this.total - this.entradaContado - this.totalDescuentosFinanciado;
    return saldo > 0 ? saldo : 0;
  }

  // Meses estimados según el pago mensual elegido
  get mesesEstimados(): number {
    if (this.pagoMensual <= 0 || this.saldoFinanciar <= 0) {
      return 0;
    }

    return Math.ceil(this.saldoFinanciar / this.pagoMensual);
  }

  // Etiqueta legible para la forma de pago elegida
  get formaPagoLabel(): string {
    return this.formaPago === 'financiado' ? 'Financiado' : 'Al contado';
  }

  // Texto amigable para mostrar la gama/tipo en el resumen
  etiquetaTipo(tipo: Vehiculo['tipo']): string {
    switch (tipo) {
      case 'auto':
        return 'Auto';
      case 'camioneta':
        return 'Camioneta';
      case 'moto':
        return 'Moto';
      case 'camion':
        return 'Camión';
      default:
        return tipo;
    }
  }

  // Ayuda de UX: desactiva el botón de confirmar si falta completar financiación
  get puedeConfirmarCompra(): boolean {
    if (this.formaPago !== 'financiado') {
      return true;
    }

    return this.pagoMensual > 0 && this.entradaContado <= this.total && this.saldoFinanciar > 0;
  }

  // Convierte el input a número y limpia errores al editar
  actualizarPagoMensual(event: Event): void {
    const valor = Number((event.target as HTMLInputElement).value);
    this.pagoMensual = Number.isFinite(valor) && valor > 0 ? valor : 0;
    this.mensajeErrorFinanciacion = '';
  }

  // Convierte el input a número y limpia errores al editar
  actualizarEntradaContado(event: Event): void {
    const valor = Number((event.target as HTMLInputElement).value);
    this.entradaContado = Number.isFinite(valor) && valor > 0 ? valor : 0;
    this.mensajeErrorFinanciacion = '';
  }

  // Cambia forma de pago y reinicia mensaje de validación
  seleccionarFormaPago(valor: 'contado' | 'financiado'): void {
    this.formaPago = valor;
    this.mensajeErrorFinanciacion = '';
  }

  // Reglas mínimas para evitar cerrar una financiación incompleta o inconsistente
  private validarFinanciacion(): boolean {
    if (this.formaPago !== 'financiado') {
      return true;
    }

    if (this.pagoMensual <= 0) {
      this.mensajeErrorFinanciacion = 'Indica cuánto quieres pagar al mes.';
      return false;
    }

    if (this.entradaContado < 0) {
      this.mensajeErrorFinanciacion = 'La entrada al contado no puede ser negativa.';
      return false;
    }

    if (this.entradaContado > this.total) {
      this.mensajeErrorFinanciacion = 'La entrada al contado no puede superar el total del pedido.';
      return false;
    }

    if (this.saldoFinanciar <= 0) {
      this.mensajeErrorFinanciacion = 'Con la entrada y descuentos no queda saldo para financiar. Ajusta los importes.';
      return false;
    }

    return true;
  }

  // Obtiene la regla de descuento priorizando modelo exacto sobre tipo
  private obtenerReglaFinanciacion(vehiculo: Vehiculo) {
    const config = this.configFinanciacion ?? this.financiacionConfigService.getConfig();
    const reglaPorModelo = config.porModelo[this.claveModelo(vehiculo)];
    if (reglaPorModelo) {
      return reglaPorModelo;
    }

    return config.porTipo[vehiculo.tipo] ?? config.base;
  }

  private claveModelo(vehiculo: Vehiculo): string {
    return this.financiacionConfigService.buildModelKey(vehiculo.marca, vehiculo.modelo);
  }

  // Confirma la compra, vacía el carrito y muestra confirmación
  confirmarCompra(): void {
    if (!this.validarFinanciacion()) {
      return;
    }

    this.numeroPedido = 'PED-' + Date.now().toString().slice(-6);
    this.carritoService.limpiar();
    this.pedidoCompletado = true;
  }

  // Vuelve al inicio tras la compra
  irAlInicio(): void {
    this.router.navigate(['/']);
  }
}
