"""Public, unauthenticated profile-completion flow: an existing customer
(added via POS import) uses a secure link to submit their date of birth,
address, and email. Never creates a customer, never exposes admin-only
fields (id, phone, total_spent, is_vip, status)."""
