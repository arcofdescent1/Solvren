# Sample Revenue Impact Report

## Decision

Stripe annual plan pricing rule update

## What Solvren found

Solvren detected a revenue-sensitive configuration change affecting annual plan checkout and renewal pricing. The change touched a pricing surface connected to billing, CRM handoff, and renewal reporting.

## Why it matters

Pricing drift can create underbilling, overbilling, support escalations, delayed renewals, and manual finance cleanup. The risk is highest when pricing rules change without proof that checkout, billing, and CRM downstream records still agree.

## Estimated exposure

- Estimated monthly recurring revenue affected: $405,000
- Customer base potentially affected: 7%
- Confidence: Medium
- Basis: affected plan volume, recent checkout activity, renewal schedule, and configured exposure assumptions

## Required proof before approval

- Before/after pricing diff
- Checkout test plan
- Rollback plan
- Monitoring plan for failed payments and renewal mismatches

## Recommended next action

Attach the missing proof, route Finance and Revenue Operations for approval, and monitor the first renewal cohort after launch.

## Executive summary

Do not ship until proof is complete. The change may be safe, but the current decision record does not yet prove that revenue, customers, and reporting are protected.
