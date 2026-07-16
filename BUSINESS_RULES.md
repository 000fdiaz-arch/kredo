# Kredo - Reglas de negocio

## 1. Principios

- El saldo de un cliente nunca se edita directamente.
- Todo cambio financiero debe provenir de un movimiento registrado.
- Los movimientos con impacto financiero no se eliminan fisicamente.
- Las correcciones se hacen anulando el movimiento original y registrando uno nuevo.
- Todo registro financiero pertenece a un usuario autenticado mediante `user_id`.
- La aplicacion debe poder soportar mas usuarios en el futuro mediante RLS.
- La experiencia de uso sera 100% en celular, por lo que las reglas deben presentarse en flujos cortos y confirmaciones faciles de revisar en pantalla pequena.

## 2. Manejo de dinero

Los montos se manejaran como enteros en centavos.

Ejemplos:

- USD 1.00 = `100`
- USD 80.00 = `8000`
- USD 8.50 = `850`

Las tasas de interes se manejaran como puntos base:

- 10% = `1000`
- 5.5% = `550`
- 1% = `100`

Formula:

```text
interes_centavos = round(capital_centavos * interest_rate_bps / 10000)
```

La conversion y formateo de moneda se centralizaran en `src/lib/money.ts`.

## 3. Saldos

El saldo se calcula desde movimientos no anulados.

Capital pendiente:

```text
prestamos
+ ajustes positivos de capital
- ajustes negativos de capital
- pagos aplicados a capital
```

Interes pendiente:

```text
intereses generados
+ ajustes positivos de interes
- ajustes negativos de interes
- pagos aplicados a interes
```

Total adeudado:

```text
capital pendiente + interes pendiente
```

Los movimientos anulados no participan en el saldo vigente, pero deben aparecer en el historial.

## 4. Prestamos

Campos minimos:

- Cliente.
- Fecha.
- Monto prestado.
- Porcentaje de interes.
- Ciclo inicial.
- Observaciones.

Reglas:

- Un prestamo aumenta inmediatamente el capital pendiente.
- El porcentaje de interes puede variar por prestamo.
- El prestamo queda vinculado a un ciclo.
- El ciclo se sugiere automaticamente segun fecha, pero el administrador puede cambiarlo antes de guardar.
- Debe existir confirmacion antes de registrar.
- No se permite monto negativo ni cero.
- No se debe crear prestamo para cliente inactivo, salvo que se decida una excepcion explicita futura.

## 5. Pagos

Campos minimos:

- Cliente.
- Fecha.
- Monto pagado.
- Metodo de pago.
- Numero de referencia.
- Observaciones.

Metodos iniciales:

- Efectivo.
- Transferencia.
- Yappy.
- ACH.
- Otro.

Regla de aplicacion:

1. Aplicar primero al interes pendiente.
2. Aplicar despues al capital pendiente.
3. Guardar el desglose exacto:
   - monto aplicado a interes.
   - monto aplicado a capital.
4. Mostrar la distribucion antes de guardar.
5. Mostrar saldo resultante antes de guardar.
6. Prevenir doble clic o registros duplicados durante el guardado.

Reglas de experiencia movil:

- Antes de guardar, mostrar una tarjeta de resumen con pago, interes aplicado, capital aplicado y saldo final.
- La confirmacion debe caber comodamente en celular.
- El boton de guardar debe deshabilitarse mientras se registra el pago.
- El campo de monto debe usar teclado numerico.
- La seleccion de cliente debe ser buscable por nombre, cedula, telefono o codigo.

Sobrepago:

- Si el pago supera la deuda total, no se debe guardar sin confirmacion especial.
- Decision propuesta para V1: permitirlo solo si el administrador confirma. El excedente no disminuye el saldo por debajo de cero. Queda pendiente decidir si se registra como saldo a favor en una version futura.

## 6. Casos obligatorios de pagos

### Caso 1: pago mayor al interes

Entrada:

- Capital: USD 80.00
- Interes: USD 8.00
- Pago: USD 10.00

Resultado:

- USD 8.00 aplicado a interes.
- USD 2.00 aplicado a capital.
- Interes pendiente: USD 0.00
- Capital pendiente: USD 78.00
- Total: USD 78.00

### Caso 2: pago inferior al interes

Entrada:

- Capital: USD 100.00
- Interes: USD 10.00
- Pago: USD 5.00

Resultado:

- USD 5.00 aplicado a interes.
- USD 0.00 aplicado a capital.
- Interes pendiente: USD 5.00
- Capital pendiente: USD 100.00
- Total: USD 105.00

### Caso 3: pago exacto del interes

Entrada:

- Capital: USD 100.00
- Interes: USD 10.00
- Pago: USD 10.00

Resultado:

- USD 10.00 aplicado a interes.
- USD 0.00 aplicado a capital.
- Interes pendiente: USD 0.00
- Capital pendiente: USD 100.00
- Total: USD 100.00

### Caso 4: pago total

Entrada:

- Capital: USD 100.00
- Interes: USD 10.00
- Pago: USD 110.00

Resultado:

- USD 10.00 aplicado a interes.
- USD 100.00 aplicado a capital.
- Interes pendiente: USD 0.00
- Capital pendiente: USD 0.00
- Total: USD 0.00

## 7. Ciclos

Los ciclos son quincenales:

- Primer ciclo: del dia 1 al dia 15.
- Segundo ciclo: del dia 16 al dia 30.

Excepcion practica:

- Si el mes tiene menos de 30 dias, el segundo cierre sera el ultimo dia real del mes.
- En meses de 31 dias, el cierre operativo se mantiene el dia 30.

Ejemplos:

- Febrero 2027: cierre el 28.
- Febrero 2028: cierre el 29.
- Julio: cierre el 30.

Cada ciclo tendra:

- Fecha inicial.
- Fecha final.
- Estado: abierto o cerrado.
- Capital inicial.
- Nuevos prestamos.
- Intereses generados.
- Pagos recibidos.
- Intereses cobrados.
- Capital recuperado.
- Capital final.
- Interes pendiente final.

Reglas:

- El sistema debe determinar el ciclo actual automaticamente.
- El administrador podra cerrar el ciclo actual.
- Al cerrar un ciclo se generan intereses.
- El cierre debe ser idempotente: no debe duplicar intereses si se ejecuta dos veces para el mismo cliente y ciclo.
- Despues de cerrar un ciclo, debe existir o sugerirse el siguiente ciclo abierto.

## 8. Asignacion de ciclo para prestamos

Regla propuesta:

- Si la fecha del prestamo esta entre dia 1 y dia 15, pertenece al ciclo que termina el dia 15.
- Si la fecha del prestamo esta entre dia 16 y dia 30, pertenece al ciclo que termina el dia 30.
- Si existe dia 31, se considera fuera del cierre operativo del dia 30 y debe revisarse como excepcion o asignarse manualmente en una fase posterior.

El administrador puede cambiar manualmente el ciclo antes de guardar.

## 9. Generacion de intereses

Formula inicial:

```text
interes del ciclo = capital pendiente * porcentaje de interes
```

Regla propuesta para V1:

- Calcular el interes sobre capital pendiente al cierre.
- Usar la tasa asociada al prestamo o tramo de capital cuando existan varios prestamos con tasas distintas.
- Si no se puede atribuir capital pendiente por tramo, usar la tasa predeterminada del cliente o la tasa por defecto de configuracion.

Ambiguedad importante:

- Cuando un cliente tiene varios prestamos con tasas diferentes y pagos parciales, hay que decidir como se reduce el capital por tramo.
- Decision recomendada: aplicar pagos a capital primero contra el tramo mas antiguo. Asi puede calcularse el interes por tramos de capital restante.

## 10. Pago inferior al interes

Cuando el cliente paga menos que el interes pendiente:

- El pago se aplica al interes.
- El interes restante continua pendiente.
- El capital no disminuye.
- El saldo total conserva el interes no pagado.
- No se capitaliza automaticamente el interes pendiente.

La arquitectura dejara espacio para una regla futura por cliente que permita capitalizacion.

## 11. Estados de clientes

Estados iniciales:

- Al dia.
- Interes pendiente.
- Atrasado.
- Sin movimientos.
- Inactivo.

Reglas propuestas:

### Sin movimientos

Cliente activo sin prestamos, pagos, intereses ni ajustes financieros.

### Al dia

Cliente activo con movimientos y sin interes vencido de ciclos anteriores.

### Interes pendiente

Cliente activo con interes pendiente del ciclo actual, pero sin interes arrastrado de ciclos anteriores.

### Atrasado

Cliente activo que llega a un ciclo posterior con intereses pendientes de uno o mas ciclos anteriores.

### Inactivo

Cliente marcado como inactivo. Conserva historial y no debe recibir nuevos prestamos salvo excepcion futura.

La logica de estado se centralizara en `src/business/clientStatus.ts` y/o una funcion SQL.

## 12. Historial

El perfil del cliente debe mostrar movimientos cronologicos:

- Prestamos.
- Pagos.
- Intereses generados.
- Ajustes.
- Notas.
- Anulaciones.

Cada movimiento debe mostrar:

- Fecha.
- Tipo.
- Monto.
- Capital afectado.
- Interes afectado.
- Saldo despues del movimiento.
- Usuario que lo realizo.
- Observaciones.
- Estado de anulacion, si aplica.

En celular, el historial se mostrara como lista cronologica de tarjetas compactas. Los detalles secundarios pueden estar dentro de una seccion expandible.

## 13. Anulaciones

No se elimina fisicamente:

- Prestamos.
- Pagos.
- Intereses.
- Ajustes.

Al anular se debe guardar:

- Fecha de anulacion.
- Usuario que anula.
- Motivo.
- Movimiento original.
- Impacto revertido por calculo.

Reglas:

- Un movimiento anulado no participa en saldos vigentes.
- El historial debe mostrarlo claramente como anulado.
- No se permite editar silenciosamente un pago ya registrado.
- Para corregir: anular y registrar el movimiento correcto.

## 14. Configuracion por usuario

Cada usuario tendra configuracion propia:

- Nombre del negocio.
- Moneda.
- Porcentaje de interes predeterminado.
- Regla de aplicacion de pagos.
- Capitalizacion de intereses activada/desactivada.
- Dia del primer cierre.
- Regla del segundo cierre.
- Metodos de pago disponibles.

Valores iniciales propuestos:

- Moneda: USD.
- Interes predeterminado: 10%.
- Aplicacion de pagos: interes primero, capital despues.
- Capitalizacion de intereses: desactivada.
- Primer cierre: dia 15.
- Segundo cierre: ultimo dia del mes.

## 15. Importacion CSV

Columnas previstas:

- Nombre.
- Cedula.
- Telefono.
- Direccion.
- Referencia.
- Telefono de referencia.
- Estado.
- Notas.

Reglas:

- Mostrar vista previa.
- Detectar duplicados por cedula, telefono o nombre similar.
- Mostrar errores por fila.
- Confirmar antes de guardar.
- No importar saldos como campos editables.
- Si en el futuro se importan saldos iniciales, se convertiran en movimientos de apertura.

## 16. Reportes

Reportes basicos:

- Cartera total.
- Capital pendiente.
- Interes pendiente.
- Prestamos otorgados por periodo.
- Pagos recibidos por periodo.
- Capital recuperado.
- Intereses cobrados.
- Clientes atrasados.
- Movimientos por cliente.

Filtros:

- Fecha inicial.
- Fecha final.
- Cliente.
- Estado.
- Tipo de movimiento.

Exportacion:

- CSV en V1.
- PDF queda fuera de alcance.

En celular, los reportes priorizaran resumenes y listas filtradas. Las columnas extensas se exportaran a CSV o se mostraran en detalle por movimiento, no como tablas anchas obligatorias.

## 17. Pruebas minimas

Se deben cubrir:

- Pago mayor al interes.
- Pago inferior al interes.
- Pago exacto del interes.
- Pago total.
- Varios prestamos en el mismo ciclo.
- Anulacion de pago.
- Cierre de febrero en ano normal y bisiesto.

Estas pruebas deben existir antes de considerar cerrada la Fase 6.
