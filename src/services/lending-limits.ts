export type LendingLimitGuidance = {
  availableCashCents: number;
  normalLimitCents: number;
  recommendedLimitCents: number;
  exceptionalLimitCents: number;
  riskLevel: "ok" | "review" | "exceptional" | "over_cash";
  message: string;
};

export function calculateFundingShortfallCents(availableCashCents: number, requestedAmountCents: number) {
  return Math.max(requestedAmountCents - availableCashCents, 0);
}

export function calculateLendingLimitGuidance(availableCashCents: number, requestedAmountCents: number): LendingLimitGuidance {
  const limitBaseCents = Math.max(availableCashCents, 0);
  const normalLimitCents = Math.floor(limitBaseCents * 0.1);
  const recommendedLimitCents = Math.floor(limitBaseCents * 0.15);
  const exceptionalLimitCents = Math.floor(limitBaseCents * 0.2);

  if (requestedAmountCents > limitBaseCents) {
    return {
      availableCashCents,
      normalLimitCents,
      recommendedLimitCents,
      exceptionalLimitCents,
      riskLevel: "over_cash",
      message: "El monto supera la caja disponible. Revisa antes de prestar.",
    };
  }

  if (requestedAmountCents > exceptionalLimitCents) {
    return {
      availableCashCents,
      normalLimitCents,
      recommendedLimitCents,
      exceptionalLimitCents,
      riskLevel: "exceptional",
      message: "Riesgo alto: supera el 20% de la caja disponible.",
    };
  }

  if (requestedAmountCents > recommendedLimitCents) {
    return {
      availableCashCents,
      normalLimitCents,
      recommendedLimitCents,
      exceptionalLimitCents,
      riskLevel: "exceptional",
      message: "Excepcion: supera el limite recomendado de 15% por persona.",
    };
  }

  if (requestedAmountCents > normalLimitCents) {
    return {
      availableCashCents,
      normalLimitCents,
      recommendedLimitCents,
      exceptionalLimitCents,
      riskLevel: "review",
      message: "Revisar: supera el limite normal de 10%, pero sigue dentro del 15% recomendado.",
    };
  }

  return {
    availableCashCents,
    normalLimitCents,
    recommendedLimitCents,
    exceptionalLimitCents,
    riskLevel: "ok",
    message: "Dentro del limite normal por persona.",
  };
}
