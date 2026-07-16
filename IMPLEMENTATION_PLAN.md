# Kredo - Plan de implementacion

## 1. Objetivo

Kredo reemplazara el archivo de Excel usado para administrar una pequena cartera de prestamos personales. La primera version debe permitir autenticar al administrador, registrar clientes, prestamos, pagos, intereses por ciclo, anulaciones, saldos calculados e historiales completos.

La prioridad es una aplicacion funcional, simple, rapida, mantenible y optimizada para uso 100% en celular. No se implementaran funciones fuera del alcance inicial como WhatsApp, app movil nativa, firma digital, buro de credito, contabilidad completa, IA, notificaciones automaticas o multiples sucursales.

## 2. Estado inicial del workspace

- El repositorio esta vacio, excepto por `.git`.
- No existe todavia proyecto Vite, codigo fuente ni migraciones.
- El archivo `C:/Users/Gedler3000/Downloads/CARTERA DE PRESTAMO.xlsm` no fue encontrado en la ruta indicada durante esta revision. La arquitectura contemplara importacion futura, pero la validacion contra datos reales queda pendiente hasta tener acceso al archivo.

## 3. Tecnologia propuesta

- Frontend: React + TypeScript + Vite.
- Estilos: Tailwind CSS.
- Backend administrado: Supabase Auth + PostgreSQL + RLS.
- Validacion de formularios: React Hook Form + Zod.
- Consultas y cache: TanStack Query.
- Rutas: React Router.
- Pruebas: Vitest + Testing Library para reglas y componentes criticos.
- Fechas: date-fns.
- Exportacion CSV: utilidad propia o libreria liviana.

## 4. Arquitectura de aplicacion

La aplicacion se organizara por modulos de negocio:

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
  components/
    layout/
    ui/
    forms/
    tables/
  features/
    auth/
    dashboard/
    clients/
    loans/
    payments/
    cycles/
    reports/
    settings/
    history/
    import/
  lib/
    supabase.ts
    money.ts
    dates.ts
    csv.ts
    errors.ts
  services/
    clients.service.ts
    loans.service.ts
    payments.service.ts
    cycles.service.ts
    reports.service.ts
  business/
    balances.ts
    payments.ts
    cycles.ts
    interest.ts
    clientStatus.ts
  types/
    database.ts
    domain.ts
  tests/
```

Separacion esperada:

- Los componentes visuales no calcularan saldos ni estados financieros.
- La logica financiera compartida vivira en `src/business`.
- La fuente principal de verdad para saldos sera la base de datos mediante vistas o funciones SQL.
- El frontend podra calcular previsualizaciones antes de guardar, pero el guardado definitivo debe validar y persistir el resultado en Supabase.
- Los servicios de Supabase aislaran consultas, mutaciones y manejo de errores.

## 5. Enfoque mobile-first

El uso esperado sera 100% desde celular. La experiencia se disenara primero para pantallas pequenas y despues se ampliara a desktop solo como compatibilidad.

Principios:

- Navegacion inferior o menu compacto en movil, con acceso rapido a Dashboard, Clientes, Prestamo, Pago y Mas.
- Botones principales grandes, faciles de tocar y ubicados cerca del pulgar.
- Formularios de una columna, con campos claros y validacion inmediata.
- Acciones frecuentes en pocos toques: crear cliente, registrar prestamo, registrar pago y buscar cliente.
- Tablas convertidas en listas de tarjetas compactas en celular.
- Tablas completas solo para pantallas grandes si resultan utiles.
- Dashboard con indicadores en tarjetas apiladas y resumen prioritario arriba.
- Busqueda siempre visible o muy cercana en Clientes y Dashboard.
- Evitar modales pequenos dificiles de usar en telefono; preferir pantallas o paneles de confirmacion de ancho completo.
- Confirmaciones cortas, con resumen financiero claro antes de guardar.
- Estados de carga y botones deshabilitados para evitar doble registro por doble toque.
- Inputs numericos configurados para teclado adecuado en celular.
- Layout compatible con safe areas y navegadores moviles.

## 6. Navegacion inicial

Rutas publicas:

- `/login`

Rutas privadas:

- `/` o `/dashboard`
- `/clients`
- `/clients/new`
- `/clients/:clientId`
- `/clients/:clientId/edit`
- `/loans/new`
- `/payments/new`
- `/cycles`
- `/history`
- `/reports`
- `/settings`

El layout privado tendra navegacion mobile-first. En celular se usara una barra inferior o menu compacto. Si se agrega soporte desktop, podra usarse navegacion lateral solo como mejora secundaria.

## 7. Fuente de verdad de saldos

Los saldos no se guardaran como campos editables en `clients`.

Se calcularan desde:

- Prestamos no anulados.
- Intereses generados no anulados.
- Pagos no anulados y su desglose.
- Ajustes autorizados.

La base de datos expondra una vista `client_balances` y, si hace falta, una funcion RPC para registrar pagos de forma atomica.

## 8. Variables de entorno

Se creara `.env.example` con:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

No se colocaran credenciales reales en el codigo ni en archivos versionables.

## 9. Estrategia de fases

### Fase 0 - Documentacion y decisiones

Archivos:

- `IMPLEMENTATION_PLAN.md`
- `BUSINESS_RULES.md`
- `DATABASE_SCHEMA.md`

Resultado:

- Arquitectura inicial revisable.
- Modelo de datos propuesto.
- Reglas financieras documentadas.
- Riesgos y ambiguedades visibles antes de implementar.

Estado: fase actual.

### Fase 1 - Base tecnica, Supabase y autenticacion

Archivos esperados:

- `package.json`
- `vite.config.ts`
- `tsconfig*.json`
- `tailwind.config.*`
- `postcss.config.*`
- `.env.example`
- `src/app/*`
- `src/features/auth/*`
- `src/lib/supabase.ts`
- `supabase/migrations/*`

Trabajo:

- Crear proyecto Vite React TypeScript.
- Configurar Tailwind.
- Configurar Supabase client.
- Crear migraciones iniciales.
- Activar RLS.
- Crear pantalla de login.
- Crear logout.
- Proteger rutas privadas.
- Crear layout base mobile-first.
- Crear navegacion inferior o compacta para celular.

Verificacion:

- `npm run build`
- pruebas basicas de auth guard si aplica.
- revision manual en local.

### Fase 2 - Clientes

Archivos esperados:

- `src/features/clients/*`
- `src/services/clients.service.ts`
- validaciones de cliente.
- componentes de tabla y formularios reutilizables.

Trabajo:

- Crear cliente.
- Editar cliente.
- Activar/desactivar cliente.
- Listar clientes en formato de tarjetas compactas para celular.
- Buscar por codigo, nombre, cedula o telefono.
- Filtrar por estado.
- Ordenar alfabeticamente y por mayor deuda.
- Crear perfil base de cliente.

Verificacion:

- Validaciones de formulario.
- Restricciones RLS.
- `npm run build`.

### Fase 3 - Prestamos, pagos, calculos e historial

Archivos esperados:

- `src/features/loans/*`
- `src/features/payments/*`
- `src/features/history/*`
- `src/business/payments.ts`
- `src/business/balances.ts`
- `src/services/loans.service.ts`
- `src/services/payments.service.ts`

Trabajo:

- Registrar prestamos.
- Registrar pagos.
- Previsualizar distribucion del pago.
- Impedir sobrepago sin confirmacion especial.
- Guardar desglose exacto de pagos.
- Mostrar historial cronologico del cliente.
- Anular movimientos con motivo.
- Optimizar flujo de pago para celular: cliente, monto, vista previa y confirmacion en pocos pasos.

Verificacion:

- Pruebas de aplicacion de pagos.
- Pruebas de anulacion de pago.
- Validacion de saldos desde vista SQL.

### Fase 4 - Ciclos, intereses y estados

Archivos esperados:

- `src/features/cycles/*`
- `src/business/cycles.ts`
- `src/business/interest.ts`
- `src/business/clientStatus.ts`
- `src/services/cycles.service.ts`

Trabajo:

- Determinar ciclo actual.
- Crear ciclos 1-15 y 16-fin de mes.
- Cerrar ciclo.
- Generar intereses sobre capital pendiente.
- Actualizar reglas de estado del cliente.
- Mostrar proximo cierre.

Verificacion:

- Pruebas de ultimo dia de febrero en ano normal y bisiesto.
- Pruebas de generacion de interes.
- Confirmacion de idempotencia para no duplicar intereses de un ciclo.

### Fase 5 - Dashboard y reportes

Archivos esperados:

- `src/features/dashboard/*`
- `src/features/reports/*`
- `src/lib/csv.ts`
- consultas o vistas de resumen.

Trabajo:

- Indicadores de cartera.
- Lista principal de clientes optimizada para celular.
- Busqueda rapida.
- Reportes con filtros.
- Exportacion CSV.

Verificacion:

- Comparar indicadores contra datos de prueba.
- Validar CSV exportado.
- `npm run build`.

### Fase 6 - Pruebas, ajustes y documentacion

Trabajo:

- Completar pruebas obligatorias.
- Pulir estados de carga, errores y confirmaciones.
- Revisar responsive desktop/mobile.
- Documentar setup local.
- Documentar migraciones y flujo de Supabase.

Verificacion:

- `npm test`
- `npm run build`
- revision manual end-to-end en viewport movil:
  - login
  - cliente
  - prestamo
  - pago
  - saldo
  - historial
  - ciclo
  - reporte

## 10. Riesgos y ambiguedades

1. Archivo Excel no disponible: no se puede validar estructura real ni datos historicos todavia.
2. Interes por prestamo vs por cliente: se permitira porcentaje por prestamo; para calcular interes de capital pendiente se necesita definir si el capital pendiente conserva tasas por tramos o si se usa una tasa activa del cliente.
3. Sobrepago: se requiere confirmar si el exceso debe rechazarse siempre o si en el futuro se registrara como saldo a favor. En esta version se permitira solo con confirmacion especial y quedara documentado.
4. Estados de atraso: se necesita precisar si "atrasado" depende estrictamente de intereses pendientes de ciclos anteriores o tambien de dias sin pago.
5. Cierre de ciclo: se debe evitar duplicar intereses si el cierre se ejecuta dos veces.
6. Anulaciones: deben ser reversibles por calculo, pero no deben borrar datos originales.
7. Multiusuario futuro: aunque haya un administrador inicial, todas las tablas principales llevaran `user_id` y RLS desde el inicio.
8. Uso 100% movil: las vistas con muchas columnas no deben depender de tablas horizontales. Se deben transformar en tarjetas, secciones plegables o vistas de detalle.

## 11. Decisiones propuestas para revision

- Guardar dinero como `integer` en centavos.
- Guardar tasa de interes como puntos base (`interest_rate_bps`), por ejemplo 10% = 1000.
- Mantener `clients.status` como estado manual/base, pero calcular un estado financiero efectivo en vistas o funciones.
- Crear `settings` por usuario para negocio, moneda, tasa por defecto, metodos de pago y reglas futuras.
- Usar vistas SQL para lectura de saldos y funciones RPC para operaciones atomicas criticas.
- No permitir edicion silenciosa de pagos o prestamos con impacto financiero; se anulan y se recrean.
- Disenar la UI con mobile-first estricto; desktop sera compatible, no el objetivo principal.

## 12. Criterio para pasar a implementacion

Antes de iniciar Fase 1 se deben revisar y aprobar:

- Modelo de tablas.
- Reglas de pago.
- Reglas de ciclo.
- Regla de interes por prestamo/cliente.
- Criterio de estados.
- Alcance de sobrepagos.
