"""Regression coverage for the dependency-boundary check; no builds or network."""

import unittest

from check_client_core import forbidden_dependencies


class ClientCoreBoundaryTests(unittest.TestCase):
    def test_accepts_the_shared_policy_dependencies(self):
        self.assertEqual(
            forbidden_dependencies("""
nahhasio-client-core v0.2.0-rc.1 (/checkout/crates/client-core)
serde v1.0.0
serde_json v1.0.0
url v2.0.0
"""),
            [],
        )

    def test_rejects_transitive_platform_build_and_target_dependencies(self):
        self.assertEqual(
            forbidden_dependencies("""
nahhasio-client-core v0.2.0-rc.1
helper v1.0.0
[build-dependencies]
gtk4-sys v0.10.0
sqlx-core v0.9.0
libmpv2-sys v4.0.1
gpui-ce v0.3.0
webkit6 v0.5.0
"""),
            ["gpui-ce", "gtk4-sys", "libmpv2-sys", "sqlx-core", "webkit6"],
        )

    def test_rejects_server_workspace_dependencies(self):
        self.assertEqual(
            forbidden_dependencies("""
nahhasio-client-core v0.2.0-rc.1
nahhasio-catalog v0.2.0-rc.1
nahhasio-server v0.2.0-rc.1
"""),
            ["nahhasio-catalog", "nahhasio-server"],
        )

    def test_deduplicates_cargo_repeats_and_ignores_headings(self):
        self.assertEqual(
            forbidden_dependencies("""
nahhasio-client-core v0.2.0-rc.1
[dev-dependencies]
gtk4 v0.10.0
gtk4 v0.10.0 (*)
"""),
            ["gtk4"],
        )

    def test_fails_closed_if_the_graph_is_missing(self):
        for tree in ["", "serde v1.0.0", "[build-dependencies]"]:
            with self.subTest(tree=tree), self.assertRaises(ValueError):
                forbidden_dependencies(tree)


if __name__ == "__main__":
    unittest.main()
