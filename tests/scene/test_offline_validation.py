from tools.export_offline_validation import export, fixtures


def test_offline_schema_and_authority_cases_do_not_drift():
    export(check=True)


def test_offline_cases_include_valid_and_invalid_whole_contract():
    cases = fixtures()
    assert any(c["valid"] for c in cases)
    assert any(not c["valid"] for c in cases)
    assert all(
        any(c["name"].startswith(name) for c in cases)
        for name in (
            "floors",
            "rooms",
            "walls",
            "doors",
            "windows",
            "columns",
            "beams",
            "electrical_points",
            "plumbing_points",
            "furniture_instances",
        )
    )
