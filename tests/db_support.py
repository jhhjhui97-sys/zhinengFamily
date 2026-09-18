from sqlalchemy.engine import make_url


def validate_test_database_url(test_url, dev_url):
    test, dev = make_url(test_url), make_url(dev_url)

    def host(url):
        return "loopback" if url.host in ("localhost", "127.0.0.1", "::1") else url.host

    if test.get_backend_name() != "postgresql" or not (test.database or "").endswith(
        "_test"
    ):
        raise ValueError("Use a dedicated PostgreSQL database ending in _test")
    if (host(test), test.port or 5432, test.database) == (
        host(dev),
        dev.port or 5432,
        dev.database,
    ):
        raise ValueError("Test database must not be the development database")
    return test_url
