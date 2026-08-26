# Kredo

Kredo es una aplicacion web mobile-first para administrar una cartera pequena de prestamos personales. La V1 cubre autenticacion, clientes, etiquetas, prestamos, pagos, calculo de intereses por ciclo, anulaciones auditables, recibos, estados de cuenta, historial general, configuracion y reportes CSV.

## Requisitos

- Node.js 20 o posterior.
- Un proyecto de Supabase.
- Supabase CLI (recomendado para aplicar migraciones y respaldar datos).

## Instalacion local

1. Ejecuta `npm install`.
2. Copia `.env.example` a `.env`.
3. Completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del proyecto.
4. Aplica, en orden, las migraciones de `supabase/migrations` mediante `supabase db push` o el editor SQL de Supabase.
5. Crea el usuario administrador en Supabase Authentication.
6. Ejecuta `npm run dev`.

Nunca publiques `.env` ni utilices la service-role key en el navegador. La aplicacion usa la anon key y protege los registros por usuario mediante RLS.

## Verificacion y compilacion

```bash
npm test -- --run
npm run build
npm run preview
```

Antes de una entrega, revisa en un telefono o viewport movil este recorrido:

1. Iniciar y cerrar sesion.
2. Crear y editar un cliente.
3. Registrar un prestamo y comprobar el recibo y saldo.
4. Registrar un pago parcial y comprobar su distribucion entre interes y capital.
5. Anular un movimiento indicando un motivo y confirmar que el saldo se revierte.
6. Generar/cerrar un ciclo dos veces y confirmar que no se duplique el interes.
7. Abrir el estado de cuenta y el historial general.
8. Guardar la configuracion, recargar la pagina y crear un prestamo con la tasa predeterminada.
9. Exportar cartera y movimientos; abrir ambos CSV en Excel.
10. Crear varias etiquetas, asignarlas a clientes, filtrar la cartera y compartir la vista como imagen desde un telefono.

## Operacion y datos

- El dinero se almacena como centavos enteros y las tasas como puntos base.
- Los saldos se calculan desde movimientos no anulados; no se editan directamente.
- Los pagos se aplican primero a interes y despues a capital.
- Prestamos y pagos financieros no se borran: se anulan con motivo para conservar auditoria.
- La tasa guardada en Configuracion se aplica como valor inicial a nuevos prestamos; puede cambiarse antes de confirmar cada prestamo.

## Respaldo y recuperacion

Configura copias de seguridad en Supabase antes de operar con dinero real. Como respaldo adicional, exporta cartera y movimientos al cierre de cada ciclo. Prueba periodicamente la restauracion en un proyecto separado; una copia no verificada no debe considerarse recuperable.

## Despliegue

El proyecto incluye `vercel.json` para resolver las rutas de React. En Vercel configura las mismas dos variables `VITE_SUPABASE_*`, ejecuta el build y valida que el dominio publicado este permitido por la configuracion de autenticacion de Supabase.

## Alcance conocido

Kredo es de un solo administrador por cuenta y utiliza USD. Puede abrir el menu nativo del telefono para compartir imagenes por WhatsApp, pero no envia mensajes automaticamente ni se conecta a WhatsApp Business. No incluye contabilidad completa, saldo a favor por sobrepago, firma digital, buro de credito, multiples sucursales ni importacion automatica desde Excel. El archivo historico original debe reconciliarse manualmente antes de retirar el control paralelo.
