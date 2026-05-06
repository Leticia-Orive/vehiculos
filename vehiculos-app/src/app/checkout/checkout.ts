import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { CarritoService, ItemCarrito } from '../carrito.service';
import { AuthService } from '../auth.service';

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

  // Costes fijos considerados para el descuento al financiar
  private readonly descuentoSeguro: number = 850;
  private readonly costoMantenimiento: number = 300;
  private readonly cantidadMantenimientos: number = 4;

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Obtiene el snapshot del carrito en el momento de entrar al checkout
    this.items = this.carritoService.items;
    this.nombreUsuario = this.authService.obtenerNombreUsuario();

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
    return this.descuentoSeguro + (this.costoMantenimiento * this.cantidadMantenimientos);
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
