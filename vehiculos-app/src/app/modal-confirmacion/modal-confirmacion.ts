import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-confirmacion',
  imports: [CommonModule],
  templateUrl: './modal-confirmacion.html',
  styleUrl: './modal-confirmacion.scss',
})
export class ModalConfirmacion {
  @Input() mostrar: boolean = false;
  @Input() titulo: string = 'Confirmar acción';
  @Input() mensaje: string = '¿Estás segura?';
  @Input() textoBtnConfirmar: string = 'Confirmar';
  @Input() textoBtnCancelar: string = 'Cancelar';

  @Output() confirmar = new EventEmitter<void>();
  @Output() cancelar = new EventEmitter<void>();

  // Emite evento al confirmar la acción
  onConfirmar(): void {
    this.confirmar.emit();
  }

  // Emite evento al cancelar
  onCancelar(): void {
    this.cancelar.emit();
  }
}
