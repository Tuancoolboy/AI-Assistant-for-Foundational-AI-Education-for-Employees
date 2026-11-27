.PHONY: verify-bitemporal

verify-bitemporal:
	PYTHONPATH=src python3 scripts/validate_logic_parity.py
