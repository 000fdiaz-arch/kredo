alter table public.loans
  add constraint loans_id_client_organization_unique unique (id, client_id, organization_id);

alter table public.loan_interest_rate_changes
  add constraint loan_interest_rate_loan_client_fk
  foreign key (loan_id, client_id, organization_id)
  references public.loans(id, client_id, organization_id)
  on delete restrict;

