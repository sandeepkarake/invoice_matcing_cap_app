---
name: match-policy
description: AP domain policy for matching invoices to purchase orders. Use before proposing, approving or escalating any match - covers amount tolerances, the confidence rubric, blocked suppliers and how to write the rationale.
---

# Match policy

Apply these rules in order for every invoice/purchase-order pair you consider. A later rule never overrides an earlier "escalate" or "do not confirm".

## 1. Blocked supplier - check first

Look up the supplier's payment data before judging the match. If the supplier is **blocked for posting**:

- Never approve (confirm) the match, no matter how strong it is.
- You may still propose it so the link is recorded, but then escalate it immediately.
- Tell Maria the supplier is blocked and quote the payment blocking reason exactly as recorded. If no reason is recorded, say so.

## 2. Amount tolerance

Compute the variance against the purchase order amount:

`variance % = |invoice amount - PO amount| / PO amount x 100`

Only compare amounts in the same currency. If the currencies differ, treat the amount as not matching and escalate.

| Variance | Treatment |
|---|---|
| 2% or less | Clean match. May be approved if nothing else blocks it. |
| More than 2%, up to 5% | Propose, but do not approve. The rationale must include a price-variance note with both amounts and the variance %. Maria decides. |
| More than 5% | Propose, then escalate. Never approve, never treat as a clean match. |

## 3. Confidence rubric

Confidence is a number from 0 to 1. Score by which signals actually matched:

| Signals | Confidence |
|---|---|
| Exact supplier match **and** amount within 2% **and** descriptions clearly describe the same goods | 0.90 - 0.99 |
| Exact supplier match **and** amount within 2%, but the descriptions only match by meaning (different wording, found through similarity search) | 0.75 - 0.89 |
| Supplier matches and the description matches by meaning, but the amount is 2-5% off | 0.50 - 0.74 |
| Partial: only one signal matches, or the supplier differs | below 0.50 - do not propose; tell Maria what you found instead |

Rules for the similarity score from the search:

- A high similarity score only tells you the descriptions sound alike. It is weaker evidence than an exact supplier and amount match.
- **Distrust a high similarity score when the amounts diverge.** If the variance is over 5%, cap confidence at 0.40 however high the similarity is.
- Never let similarity alone lift a match into the top band.

## 4. When you may approve

Approve only when **all** of these hold:

- the supplier is not blocked for posting,
- the variance is 2% or less and the currencies are the same,
- confidence is 0.90 or higher.

Otherwise leave the match proposed (2-5% variance) or escalate it (blocked supplier, over 5%, currency mismatch). Every approval still waits for Maria's sign-off.

## 5. Rationale

Every proposal needs a rationale of one or two sentences that Maria can act on without re-checking the data. It must say:

- which signals matched: supplier, amount (with the variance % when it is not exact), description (and whether it matched by wording or only by meaning),
- what is wrong or missing, if anything,
- what Maria should do: approve, review the variance, or investigate before paying.

Examples:

- "Supplier and amount match exactly (USD 18,750.00); 'Office furniture delivery' and 'Height-adjustable workstation - 25 units' describe the same goods (matched by meaning). Safe to approve."
- "Supplier and description match, but the invoice is USD 150.00 (3.0%) above the PO. Check whether the extra charge was agreed before approving."
- "Strong match on supplier, amount and description, but the supplier is blocked for posting (reason B). Escalated - do not pay until the block is cleared."
