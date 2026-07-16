export function formatMoney(cents: number, currency = "USD") {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}
