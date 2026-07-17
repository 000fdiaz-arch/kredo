export type FinancialMovementType =
  | "capital_contribution"
  | "capital_withdrawal"
  | "loan_disbursement"
  | "principal_recovery"
  | "interest_income"
  | "late_fee_income"
  | "expense"
  | "loan_loss"
  | "adjustment";

export type FinancialMovementInput = {
  movement_type: FinancialMovementType;
  amount_cents: number;
  date?: string;
};

export type FinancialSummary = {
  capitalContributedCents: number;
  capitalWithdrawnCents: number;
  netContributedCapitalCents: number;
  activePortfolioCents: number;
  availableCashCents: number;
  interestCollectedCents: number;
  netProfitCents: number;
  loanVolumeCents: number;
  principalRecoveredCents: number;
  loanCount: number;
  paidLoanCount: number;
  recoveryRate: number;
  capitalRotation: number;
};

function sumByType(movements: FinancialMovementInput[], type: FinancialMovementType) {
  return movements
    .filter((movement) => movement.movement_type === type)
    .reduce((total, movement) => total + movement.amount_cents, 0);
}

function countByType(movements: FinancialMovementInput[], type: FinancialMovementType) {
  return movements.filter((movement) => movement.movement_type === type && movement.amount_cents > 0).length;
}

export function calculateFinancialSummary(movements: FinancialMovementInput[]): FinancialSummary {
  const capitalContributedCents = sumByType(movements, "capital_contribution");
  const capitalWithdrawnCents = sumByType(movements, "capital_withdrawal");
  const loanVolumeCents = sumByType(movements, "loan_disbursement");
  const principalRecoveredCents = sumByType(movements, "principal_recovery");
  const interestCollectedCents = sumByType(movements, "interest_income");
  const lateFeeIncomeCents = sumByType(movements, "late_fee_income");
  const expensesCents = sumByType(movements, "expense");
  const loanLossCents = sumByType(movements, "loan_loss");
  const adjustmentCents = sumByType(movements, "adjustment");
  const netContributedCapitalCents = capitalContributedCents - capitalWithdrawnCents;
  const activePortfolioCents = Math.max(loanVolumeCents + adjustmentCents - principalRecoveredCents - loanLossCents, 0);
  const availableCashCents =
    capitalContributedCents +
    principalRecoveredCents +
    interestCollectedCents +
    lateFeeIncomeCents -
    loanVolumeCents -
    capitalWithdrawnCents -
    expensesCents;
  const netProfitCents = interestCollectedCents + lateFeeIncomeCents - expensesCents - loanLossCents;
  const loanCount = countByType(movements, "loan_disbursement");
  const paidLoanCount = countByType(movements, "principal_recovery");
  const recoveryRate = loanVolumeCents > 0 ? principalRecoveredCents / loanVolumeCents : 0;
  const capitalRotation = netContributedCapitalCents > 0 ? loanVolumeCents / netContributedCapitalCents : 0;

  return {
    capitalContributedCents,
    capitalWithdrawnCents,
    netContributedCapitalCents,
    activePortfolioCents,
    availableCashCents,
    interestCollectedCents,
    netProfitCents,
    loanVolumeCents,
    principalRecoveredCents,
    loanCount,
    paidLoanCount,
    recoveryRate,
    capitalRotation,
  };
}
