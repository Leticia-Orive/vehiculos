import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-confirmacion',
  imports: [CommonModule],
  templateUrl: './modal-confirmacion.html',
  styleUrl: './modal-confirmacion.scss',
})
/**
 * Modal reutilizable de confirmación.
 * Emite eventos de confirmar/cancelar y soporta cierre por Escape/click fuera.
 */
export class ModalConfirmacion {
  @Input() mostrar: boolean = false;
  @Input() titulo: string = 'Confirmar acción';
  @Input() mensaje: string = '¿Estás segura?';
  @Input() textoBtnConfirmar: string = 'Confirmar';
  @Input() textoBtnCancelar: string = 'Cancelar';
  @Input() tipo: 'info' | 'warning' | 'error' | 'success' = 'info';
  @Input() icono: string = '';
  @Input() cerrarConEscape: boolean = true;
  @Input() cerrarAlClickFuera: boolean = true;

  get iconoDefecto(): string {
    if (this.icono) return this.icono;
    return { info: 'ℹ', warning: '⚠', error: '❌', success: '✓' }[this.tipo];
  }

  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mostrar && this.cerrarConEscape) {
      this.onCancelar();
    }
  }

  // Emite evento al confirmar la acción
  onConfirmar(): void {
    this.confirmar.emit();
  }

  // Emite evento al cancelar
  onCancelar(): void {
    this.cancelar.emit();
  }

  onOverlayClick(): void {
    if (this.cerrarAlClickFuera) {
      this.onCancelar();
    }
  }
}
