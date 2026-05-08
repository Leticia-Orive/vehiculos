import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
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
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  private readonly checkoutDatosKey = 'vehiculos.checkout.datosEntrega';
  private readonly checkoutFormaPagoKey = 'vehiculos.checkout.formaPago';
  private readonly checkoutFinanciacionKey = 'vehiculos.checkout.financiacion';
  @ViewChild('emailInput') emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('direccionInput') direccionInput?: ElementRef<HTMLInputElement>;
  @ViewChild('telefonoInput') telefonoInput?: ElementRef<HTMLInputElement>;
  @ViewChild('pagoMensualInput') pagoMensualInput?: ElementRef<HTMLInputElement>;
  @ViewChild('entradaContadoInput') entradaContadoInput?: ElementRef<HTMLInputElement>;

  // Estado general de la pantalla
  items: ItemCarrito[] = [];
  nombreUsuario: string = '';
  pedidoCompletado: boolean = false;
  mostrarBannerFinanciacion: boolean = false;
  private bannerTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveUiTimer: ReturnType<typeof setTimeout> | null = null;
  numeroPedido: string = '';
  confettiItems: { id: number; left: number; delay: number; color: string; duration: number }[] = [];

  // Datos de forma de pago
  formaPago: 'contado' | 'financiado' = 'contado';
  pagoMensual: number = 0;
  entradaContado: number = 0;
  mensajeErrorFinanciacion: string = '';
  mensajeErrorEntrega: string = '';
  configFinanciacion: FinanciacionConfigState | null = null;

  // Datos de entrega (validación)
  email: string = '';
  direccion: string = '';
  telefono: string = '';
  intentoConfirmar: boolean = false;
  emailTocado: boolean = false;
  direccionTocada: boolean = false;
  telefonoTocado: boolean = false;
  mostrarResumenDetallado: boolean = false;
  estadoAutoguardado: 'idle' | 'saving' | 'saved' = 'idle';

  constructor(
    private carritoService: CarritoService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private financiacionConfigService: FinanciacionConfigService,
    private titleService: Title
  ) {}

  ngOnInit(): void {
    this.titleService.setTitle('Checkout | Vehículos');
    // Obtiene el snapshot del carrito en el momento de entrar al checkout
    this.items = this.carritoService.items;
    this.nombreUsuario = this.authService.obtenerNombreUsuario();
    this.configFinanciacion = this.financiacionConfigService.getConfig();
    this.restaurarDatosEntrega();
    this.restaurarFormaPago();
    this.restaurarFinanciacion();

    const pago = this.route.snapshot.queryParamMap.get('pago');
    if (pago === 'financiado') {
      this.formaPago = 'financiado';
      this.guardarFormaPago();
      this.guardarFinanciacion();
      this.mostrarBannerFinanciacion = true;
      this.bannerTimer = setTimeout(() => {
        this.mostrarBannerFinanciacion = false;
        this.bannerTimer = null;
      }, 5000);
    }

    // Si el carrito está vacío, redirige al inicio
    if (this.items.length === 0) {
      this.router.navigate(['/']);
    }
  }

  ngOnDestroy(): void {
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
    }
    if (this.autosaveUiTimer) {
      clearTimeout(this.autosaveUiTimer);
    }
  }

  cerrarBannerFinanciacion(): void {
    this.mostrarBannerFinanciacion = false;
    if (this.bannerTimer) {
      clearTimeout(this.bannerTimer);
      this.bannerTimer = null;
    }
  }

  toggleResumenDetallado(): void {
    this.mostrarResumenDetallado = !this.mostrarResumenDetallado;
  }

  // Calcula el total del pedido delegando en el servicio del carrito
  get total(): number {
    return this.carritoService.total;
  }

  // Valida si el email es válido
  get emailValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email);
  }

  // Verifica que todos los campos de entrega estén completos
  get datosEntregaCompletos(): boolean {
    return !!this.email && this.emailValido && !!this.direccion.trim() && this.telefonoValido;
  }

  get telefonoValido(): boolean {
    return this.telefono.length >= 9;
  }

  get datosEntregaCompletadosCount(): number {
    let completados = 0;
    if (this.email && this.emailValido) completados++;
    if (this.direccion.trim()) completados++;
    if (this.telefonoValido) completados++;
    return completados;
  }

  get progresoEntrega(): number {
    return Math.round((this.datosEntregaCompletadosCount / 3) * 100);
  }

  get camposEntregaFaltantes(): number {
    return Math.max(0, 3 - this.datosEntregaCompletadosCount);
  }

  get telefonoFormateado(): string {
    const d = this.telefono;
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
    if (d.length <= 10) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
    return `${d.slice(0, 3)} ${d.slice(3, 7)} ${d.slice(7)}`;
  }

  // Deshabilitado si faltan datos o si es financiado sin parámetros válidos
  get botonConfirmarDeshabilitado(): boolean {
    if (!this.datosEntregaCompletos) return true;
    if (this.formaPago === 'financiado') {
      return this.pagoMensual <= 0 || this.entradaContado < 0;
    }
    return false;
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
    this.guardarFinanciacion();
    this.mensajeErrorFinanciacion = '';
  }

  actualizarEmail(valor: string): void {
    this.email = valor;
    this.mensajeErrorEntrega = '';
    this.guardarDatosEntrega();
  }

  blurEmail(): void {
    this.emailTocado = true;
  }

  actualizarDireccion(valor: string): void {
    this.direccion = valor;
    this.mensajeErrorEntrega = '';
    this.guardarDatosEntrega();
  }

  blurDireccion(): void {
    this.direccionTocada = true;
  }

  actualizarTelefono(valor: string): void {
    this.telefono = valor.replace(/\D/g, '').slice(0, 15);
    this.mensajeErrorEntrega = '';
    this.guardarDatosEntrega();
  }

  blurTelefono(): void {
    this.telefonoTocado = true;
  }

  // Convierte el input a número y limpia errores al editar
  actualizarEntradaContado(event: Event): void {
    const valor = Number((event.target as HTMLInputElement).value);
    this.entradaContado = Number.isFinite(valor) && valor > 0 ? valor : 0;
    this.guardarFinanciacion();
    this.mensajeErrorFinanciacion = '';
  }

  // Cambia forma de pago y reinicia mensaje de validación
  seleccionarFormaPago(valor: 'contado' | 'financiado'): void {
    this.formaPago = valor;
    this.guardarFormaPago();
    this.guardarFinanciacion();
    this.mensajeErrorFinanciacion = '';
  }

  intentarConfirmarCompra(): void {
    this.intentoConfirmar = true;

    if (!this.validarEntrega()) {
      return;
    }

    if (!this.validarFinanciacion()) {
      this.enfocarCampoFinanciacion();
      return;
    }

    this.confirmarCompra();
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

  private validarEntrega(): boolean {
    if (!this.email || !this.emailValido) {
      this.mensajeErrorEntrega = 'Revisa el email para continuar.';
      this.emailInput?.nativeElement.focus();
      return false;
    }

    if (!this.direccion.trim()) {
      this.mensajeErrorEntrega = 'La direccion de entrega es obligatoria.';
      this.direccionInput?.nativeElement.focus();
      return false;
    }

    if (!this.telefonoValido) {
      this.mensajeErrorEntrega = 'El telefono debe tener al menos 9 digitos.';
      this.telefonoInput?.nativeElement.focus();
      return false;
    }

    this.mensajeErrorEntrega = '';
    return true;
  }

  private enfocarCampoFinanciacion(): void {
    if (this.formaPago !== 'financiado') {
      return;
    }

    if (this.pagoMensual <= 0) {
      this.pagoMensualInput?.nativeElement.focus();
      return;
    }

    if (this.entradaContado < 0 || this.entradaContado > this.total) {
      this.entradaContadoInput?.nativeElement.focus();
      return;
    }
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
    localStorage.removeItem(this.checkoutDatosKey);
    localStorage.removeItem(this.checkoutFormaPagoKey);
    localStorage.removeItem(this.checkoutFinanciacionKey);
    this.titleService.setTitle('¡Compra confirmada! | Vehículos');
    this.generarConfetti();
    this.pedidoCompletado = true;
  }

  // Vuelve al inicio tras la compra
  irAlInicio(): void {
    this.router.navigate(['/']);
  }

  private generarConfetti(): void {
    const colores = ['#ffd740', '#ff4081', '#00e676', '#40c4ff', '#e040fb', '#ff6d00'];
    this.confettiItems = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1200,
      duration: 1800 + Math.random() * 1200,
      color: colores[Math.floor(Math.random() * colores.length)],
    }));
  }

  private guardarDatosEntrega(): void {
    const datos = {
      email: this.email,
      direccion: this.direccion,
      telefono: this.telefono,
    };
    localStorage.setItem(this.checkoutDatosKey, JSON.stringify(datos));
    this.marcarAutoguardado();
  }

  private restaurarDatosEntrega(): void {
    const raw = localStorage.getItem(this.checkoutDatosKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { email?: string; direccion?: string; telefono?: string };
      this.email = parsed.email ?? '';
      this.direccion = parsed.direccion ?? '';
      this.telefono = (parsed.telefono ?? '').replace(/\D/g, '').slice(0, 15);
    } catch {
      localStorage.removeItem(this.checkoutDatosKey);
    }
  }

  private guardarFormaPago(): void {
    localStorage.setItem(this.checkoutFormaPagoKey, this.formaPago);
    this.marcarAutoguardado();
  }

  private restaurarFormaPago(): void {
    const guardada = localStorage.getItem(this.checkoutFormaPagoKey);
    if (guardada === 'contado' || guardada === 'financiado') {
      this.formaPago = guardada;
    }
  }

  private guardarFinanciacion(): void {
    const payload = {
      formaPago: this.formaPago,
      pagoMensual: this.pagoMensual,
      entradaContado: this.entradaContado,
    };
    localStorage.setItem(this.checkoutFinanciacionKey, JSON.stringify(payload));
    this.marcarAutoguardado();
  }

  private marcarAutoguardado(): void {
    this.estadoAutoguardado = 'saving';
    if (this.autosaveUiTimer) {
      clearTimeout(this.autosaveUiTimer);
    }

    this.autosaveUiTimer = setTimeout(() => {
      this.estadoAutoguardado = 'saved';
      this.autosaveUiTimer = null;
    }, 240);
  }

  private restaurarFinanciacion(): void {
    const raw = localStorage.getItem(this.checkoutFinanciacionKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { formaPago?: string; pagoMensual?: number; entradaContado?: number };
      if (parsed.formaPago === 'contado' || parsed.formaPago === 'financiado') {
        this.formaPago = parsed.formaPago;
      }

      const pagoMensual = Number(parsed.pagoMensual);
      const entradaContado = Number(parsed.entradaContado);

      this.pagoMensual = Number.isFinite(pagoMensual) && pagoMensual > 0 ? pagoMensual : 0;
      this.entradaContado = Number.isFinite(entradaContado) && entradaContado > 0 ? entradaContado : 0;
    } catch {
      localStorage.removeItem(this.checkoutFinanciacionKey);
    }
  }
}
