VENV_DIR := .venv
PY := $(VENV_DIR)/bin/python

.PHONY: venv install test

venv:
	/usr/bin/python -m venv $(VENV_DIR)

install:
	$(PY) -m pip install -r requirements.txt

test:
	$(PY) -m pytest
