"""Fail explicitly if the selected runtime's Python ABI changes beneath locked wheels."""
import sys

if sys.version_info[:2] != (3, 13):
    raise SystemExit("GNOME 50 Python ABI changed: regenerate python-sources.json for the SDK ABI")
