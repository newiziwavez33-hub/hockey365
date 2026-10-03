import os
import sys
import pytest

# Ensure root directory is on sys.path
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from tools.validate_data import validate_all

def test_all_schemas_and_business_rules():
    is_valid = validate_all(ROOT_DIR)
    assert is_valid is True, "Data validation failed! Check schemas or business rules."
