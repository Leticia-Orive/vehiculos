import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { AuthService } from './auth.service';
import { CarritoService } from './carrito.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  autenticado = false;
  esAdmin = false;
  nombreUsuario = '';
  cantidadCarrito = 0;
  mostrarScrollTop = false;

  private subs = new Subscription();

  constructor(
    private authService: AuthService,
    private carritoService: CarritoService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.authService.autenticado$.subscribe((auth) => {
        this.autenticado = auth;
        this.esAdmin = this.authService.esAdmin();
        this.nombreUsuario = this.authService.obtenerNombreUsuario();
      }),
    );
    this.subs.add(
      this.carritoService.items$
        .pipe(map((items) => items.reduce((acc, i) => acc + i.cantidad, 0)))
        .subscribe((count) => {
          this.cantidadCarrito = count;
        }),
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  @HostListener('window:scroll')
  onScroll(): void {
    this.mostrarScrollTop = window.scrollY > 350;
  }

  scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
