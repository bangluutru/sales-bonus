"""Validate provisional source extraction; not a financial-engine regression."""
from pathlib import Path
from fractions import Fraction
import csv
import json
import re

root = Path(__file__).resolve().parents[1]
data = root / 'data/reference'
manifest = json.loads((data / 'genki-product-prices.source.json').read_text())
with (data / 'genki-product-prices.provisional.csv').open(encoding='utf-8-sig', newline='') as f:
    rows = list(csv.DictReader(f))
assert len(rows) == manifest['record_count'] == 46
assert len({r['jan'] for r in rows}) == 46
assert sum(r['source_section'] == 'GENKI_FAMI' for r in rows) == 8
assert sum(r['source_section'] == 'THONG_TIN_THAM_KHAO' for r in rows) == 38
for row in rows:
    assert row['source_sha256'] == manifest['source_sha256']
    assert row['status'] == 'PROVISIONAL_REFERENCE'
    assert row['effective_from'] == row['effective_to'] == ''
    gross = int(row['list_price_including_vat_vnd'])
    discount = int(row['source_discount_percent_reference_only'])
    dealer = int(row['source_dealer_price_including_vat_vnd'])
    vat = int(row['source_vat_percent'])
    assert gross * (100 - discount) == dealer * 100
    assert Fraction(row['list_price_excluding_vat_numerator']) / int(row['list_price_excluding_vat_denominator']) == Fraction(gross * 100, 100 + vat)
    jan = row['jan']
    checksum_valid = (sum(int(n) * (1 if i % 2 == 0 else 3) for i, n in enumerate(jan[:12])) + int(jan[12])) % 10 == 0
    assert checksum_valid == ('JAN_CHECKSUM_INVALID_SOURCE_PRESERVED' not in row['review_flags'])
assert [r['jan'] for r in rows if 'JAN_CHECKSUM_INVALID' in r['review_flags']] == manifest['jan_checksum_failures']
assert {int(r['source_page']) for r in rows} == {1, 2, 3, 4}
for doc in [root / 'README.md', root / 'PRODUCTION_READINESS.md', *sorted((root / 'docs').rglob('*.md'))]:
    for link in re.findall(r'\]\(([^)]+)\)', doc.read_text()):
        if not re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*:', link):
            assert (doc.parent / link.split('#')[0]).exists(), (doc, link)
print('PASS: 46 source records; 46 exact quoted-price reconciliations; 46 exact VAT conversions; provenance, anomaly flags and documentation links verified.')
print('Source extraction check only; no live AMIS or historical Golden Dataset validation.')
