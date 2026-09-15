"""Validation for human names (customers, staff users, public form
submitters) — as opposed to resource names like a form, gift, or campaign
title, which may legitimately contain digits and symbols.

Deliberately unicode-aware (`str.isalpha()`) rather than an ASCII
`[A-Za-z]` regex, since customer names are frequently in Bengali script.
"""

_ALLOWED_SEPARATORS = " '-"


def validate_person_name(value: str) -> str:
    """Strips and validates a person's name. Raises `ValueError` (which
    Pydantic's `field_validator` turns into a 422) if the name is blank,
    contains anything other than letters/spaces/hyphens/apostrophes, or is
    just one character repeated (e.g. "aaaaaaa" — junk data from a bad
    import or a careless form fill, not a real name)."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("Name cannot be blank")

    if not all(ch.isalpha() or ch in _ALLOWED_SEPARATORS for ch in stripped):
        raise ValueError("Name may only contain letters, spaces, hyphens, and apostrophes")

    letters = [ch.lower() for ch in stripped if ch.isalpha()]
    if len(set(letters)) == 1:
        raise ValueError("Name cannot be a single character repeated")

    return stripped
