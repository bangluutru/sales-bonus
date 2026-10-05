# PM Commission & Bonus Management System

Status: **PHASE 1 foundation checkpoint — domain code and migration implemented; historical/source gates pending. NOT PRODUCTION READY.**

This repository starts from the supplied [master build directive](docs/master-build-directive.md). User authorized starting build on 2026-10-05. The tested foundation implements explicit resolved contracts; section 33 still prevents financially consequential guesses and production activation of incomplete rules.

## Review documents

- [Architecture](docs/architecture.md)
- [Domain model](docs/domain-model.md)
- [Calculation specification](docs/calculation-spec.md)
- [AMIS API discovery](docs/integrations/amis-api-discovery.md)
- [AMIS field mapping](docs/integrations/amis-field-mapping.md)
- [Security model](docs/security-model.md)
- [Test plan](docs/test-plan.md)
- [Business decisions: resolved and pending](docs/business-decisions.md)
- [Product pricing and source review](docs/product-pricing.md)
- [46-product provisional price CSV](data/reference/genki-product-prices.provisional.csv)
- [Historical validation status](docs/validation/golden-dataset.md)
- [Phase gates](docs/implementation-plan.md)
- [Production readiness](PRODUCTION_READINESS.md)

Documents distinguish directive requirements, design proposals, documented API fields, and unverified tenant behavior. Example numbers are synthetic, never historical evidence.

## Environment inspected — 2026-10-05 (Asia/Tokyo)

The workspace was empty and was not a Git repository. No inherited AGENTS.md was found in the ancestor paths checked. At initial discovery the only supplied attachment was the directive; no historical workbook or approved dashboard reference was present. Update: user supplied a 4-page GENKI price quotation; 46 product records have been extracted and visually checked as provisional references. This does not replace the historical workbook. A targeted workbook search in attachments and the adjacent xtools tree found unrelated workbooks only. No credentials were searched for or requested in chat. TypeScript domain modules and a PostgreSQL migration now exist with 24 passing automated tests (19 domain and 5 isolated PostgreSQL migration tests). No browser application, live tenant API test, live database migration or deployment is claimed.

Six business directions plus 1,000-VND ceiling rounding are recorded; remaining source and financial details are explicitly pending in the decision register. Next: finish tenant/workbook discovery and unresolved rules, before production activation and later phases. Git is initialized for phase checkpoint commits.

## Run the foundation

Node 22 or later and Python 3 required. `npm ci`, then `npm run check` runs lint, strict typecheck, compiled unit/migration tests and provisional source validation. `npm audit` checks dependencies. Core code: [domain modules](packages/domain/index.ts); [PostgreSQL migration](migrations/001_domain_foundation.sql).

Current calculations are canonical domain scenarios with explicitly supplied economic basis/recognition inputs, not tenant-connected production settlements. Unknown source schemas and historical values are not synthesized.

[Build checkpoint](docs/BUILD_STATUS.md) · [Resumption schedule/script](docs/resume-build.md). Same-chat continuation attempts: 23:55 on 05/10/2026 and 05:00 on 06/10/2026, Asia/Tokyo.
